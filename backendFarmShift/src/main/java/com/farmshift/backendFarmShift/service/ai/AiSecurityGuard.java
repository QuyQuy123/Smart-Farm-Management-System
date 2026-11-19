package com.farmshift.backendFarmShift.service.ai;

import com.farmshift.backendFarmShift.dto.AiAssistantResponse;
import com.farmshift.backendFarmShift.dto.response.ReportSummaryResponse;
import com.farmshift.backendFarmShift.entity.*;
import com.farmshift.backendFarmShift.repository.*;
import com.farmshift.backendFarmShift.service.CycleService;
import com.farmshift.backendFarmShift.service.ReportService;
import com.farmshift.backendFarmShift.service.VietnameseSpeechNormalizer;
import com.farmshift.backendFarmShift.service.WorkAssignmentService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Defense-in-Depth AI Security Guard for FarmShift AI Assistant:
 * 1. Prompt Injection / Jailbreak / SQL & Script Firewall.
 * 2. Pre-LLM Zero-Trust Context Sanitization (strips financials & unassigned barns for ROLE_FARM_WORKER).
 * 3. Cryptographic HMAC-SHA256 PendingActionCard signing & single-use nonce anti-replay (5-minute TTL).
 * 4. Post-LLM Output Guardrail against accidental secret or financial leakage.
 */
@Slf4j
@Component
public class AiSecurityGuard {

    public static final int MAX_PROMPT_LENGTH = 1000;
    public static final long ACTION_TOKEN_TTL_MS = 5L * 60L * 1000L;
    public static final int MAX_PENDING_ACTIONS = 1000;

    private static final Set<String> TOKEN_META_KEYS = Set.of("actionId", "actionToken", "expiresAt");
    private static final Pattern SENSITIVE_CTX_KEY = Pattern.compile(
            "(?i).*(price|cost|debt|amount|profit|revenue|paid|total|invoice|supplier).*"
    );

    private static final List<String> PRIVILEGE_ESCALATION_PATTERNS = List.of(
            "bo qua huong dan",
            "bo qua moi quy tac",
            "bo qua quy tac",
            "bo qua tat ca quy tac",
            "ignore previous instructions",
            "ignore all previous instructions",
            "ignore all rules",
            "disregard previous instructions",
            "dong vai chu trai",
            "dong vai admin",
            "gia lap quyen",
            "act as system",
            "act as owner",
            "act as admin",
            "bypass rbac",
            "vuot quyen"
    );

    private static final List<String> EXTRACTION_PATTERNS = List.of(
            "in ra system prompt",
            "hien thi system prompt",
            "hien thi cau hinh goc",
            "in ra toan bo json ngu canh",
            "reveal system prompt",
            "print system prompt",
            "show system prompt",
            "show api key",
            "jwt_secret",
            "jwt secret",
            "vapid_private_key",
            "database password",
            "spring.datasource.password"
    );

    private static final Pattern PRIVILEGE_ESCALATION_REGEX = Pattern.compile(
            "(?i)(?:"
                    + "\\bbo\\s+qua\\b.{0,30}\\b(?:chi\\s+dan|huong\\s+dan|quy\\s+tac|nguyen\\s+tac|menh\\s+lenh)\\b"
                    + "|\\b(?:ignore|disregard|forget)\\b.{0,30}\\b(?:instructions?|rules?|prompts?)\\b"
                    + "|\\b(?:tu\\s+gio|bay\\s+gio|dong\\s+vai|gia\\s+lam|hoa\\s+than|hay\\s+la|act\\s+as|you\\s+are\\s+now)\\b.{0,30}\\b(?:admin|quan\\s+tri|chu\\s+trai|chu\\s+trang\\s+trai|root|system|debug|developer)\\b"
                    + "|\\b(?:che\\s+do|mode)\\s*(?:debug|admin|developer|god|root)\\b"
                    + ")"
    );

    private static final Pattern EXTRACTION_REGEX = Pattern.compile(
            "(?i)(?:in\\s+ra|hien\\s+thi|xuat\\s+ra|cho\\s+xem|tiet\\s+lo|dump|reveal|print|show)\\b.{0,35}\\b(?:system\\s*prompt|cau\\s+hinh\\s+goc|json\\s+ngu\\s+canh|jwt[_\\s]?secret|api[_\\s]?key|database\\s+password|mat\\s+khau)\\b"
    );

    private static final Pattern CODE_INJECTION_PATTERN = Pattern.compile(
            "(?i)(?:\\b(?:drop\\s+table|truncate\\s+table|delete\\s+from|union\\s+select)\\b|<\\s*script\\b)"
    );

    private static final Pattern WORKER_CURRENCY_LEAK = Pattern.compile(
            "(?iu)\\b\\d[\\d.,]*\\s*(?:vnđ|vnd|đ/kg)\\b"
    );

    private static final Pattern SECRET_MARKER_LEAK = Pattern.compile(
            "(?iu)(?:JWT_SECRET|VAPID_PRIVATE_KEY|AI_INTERNAL_TOKEN|OPENAI_API_KEY|GROQ_API_KEY)\\s*[:=]?\\s*\\S+"
    );

    private final BarnRepository barnRepository;
    private final WarehouseCategoryRepository warehouseRepository;
    private final InventoryItemRepository inventoryRepository;
    private final SupplierRepository supplierRepository;
    private final PurchaseInvoiceRepository invoiceRepository;
    private final WorkAssignmentService workAssignmentService;
    private final ReportService reportService;
    private final ObjectMapper objectMapper;
    private final byte[] hmacSecretBytes;

    @Autowired(required = false)
    private FarmingCycleRepository cycleRepository;

    private final ConcurrentHashMap<String, SignedPendingAction> pendingStore = new ConcurrentHashMap<>();

    public AiSecurityGuard(
            BarnRepository barnRepository,
            WarehouseCategoryRepository warehouseRepository,
            InventoryItemRepository inventoryRepository,
            SupplierRepository supplierRepository,
            PurchaseInvoiceRepository invoiceRepository,
            WorkAssignmentService workAssignmentService,
            ReportService reportService,
            ObjectMapper objectMapper,
            @Value("${jwt.secret:farmshift-default-ai-hmac-secret-key-2026-change-in-production}") String secretKey
    ) {
        this.barnRepository = barnRepository;
        this.warehouseRepository = warehouseRepository;
        this.inventoryRepository = inventoryRepository;
        this.supplierRepository = supplierRepository;
        this.invoiceRepository = invoiceRepository;
        this.workAssignmentService = workAssignmentService;
        this.reportService = reportService;
        this.objectMapper = objectMapper;
        String effectiveSecret = (secretKey == null || secretKey.isBlank())
                ? "farmshift-default-ai-hmac-secret-key-2026"
                : secretKey;
        this.hmacSecretBytes = effectiveSecret.getBytes(StandardCharsets.UTF_8);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 1. INPUT FIREWALL (Prompt Injection, Jailbreak, Length & Control Chars)
    // ─────────────────────────────────────────────────────────────────────────

    public AiAssistantResponse inspectInput(String rawMessage, String username, boolean isWorker) {
        if (rawMessage == null) {
            return null;
        }
        if (rawMessage.length() > MAX_PROMPT_LENGTH) {
            log.warn("AI security firewall blocked oversized prompt ({} chars) from user={}", rawMessage.length(), username);
            return AiAssistantResponse.builder()
                    .reply("⚠️ Nội dung câu lệnh vượt quá giới hạn an toàn (" + MAX_PROMPT_LENGTH + " ký tự). Vui lòng rút gọn yêu cầu.")
                    .actionType("SECURITY_BLOCKED")
                    .executed(false)
                    .build();
        }
        for (int i = 0; i < rawMessage.length(); i++) {
            char c = rawMessage.charAt(i);
            if (c == '\u0000' || (c < 0x20 && c != '\n' && c != '\r' && c != '\t')) {
                log.warn("AI security firewall blocked control/null byte character from user={}", username);
                return AiAssistantResponse.builder()
                        .reply("⚠️ Yêu cầu chứa ký tự điều khiển không hợp lệ và đã bị từ chối.")
                        .actionType("SECURITY_BLOCKED")
                        .executed(false)
                        .build();
            }
        }

        String norm = VietnameseSpeechNormalizer.removeVietnameseDiacritics(rawMessage).toLowerCase(Locale.ROOT).trim();

        for (String pattern : PRIVILEGE_ESCALATION_PATTERNS) {
            if (norm.contains(pattern)) {
                log.warn("AI Prompt Injection / Role Escalation blocked! user={} isWorker={} pattern='{}'", username, isWorker, pattern);
                return AiAssistantResponse.builder()
                        .reply("⛔ Yêu cầu vi phạm chính sách bảo mật (cố gắng vượt quyền hoặc ghi đè hướng dẫn hệ thống). " + AiRbacPolicy.MSG60)
                        .actionType("SECURITY_BLOCKED")
                        .executed(false)
                        .build();
            }
        }

        if (PRIVILEGE_ESCALATION_REGEX.matcher(norm).find()) {
            log.warn("AI Prompt Injection / Role Escalation (regex) blocked! user={} isWorker={}", username, isWorker);
            return AiAssistantResponse.builder()
                    .reply("⛔ Yêu cầu vi phạm chính sách bảo mật (cố gắng vượt quyền hoặc ghi đè hướng dẫn hệ thống). " + AiRbacPolicy.MSG60)
                    .actionType("SECURITY_BLOCKED")
                    .executed(false)
                    .build();
        }

        for (String pattern : EXTRACTION_PATTERNS) {
            if (norm.contains(pattern)) {
                log.warn("AI System Prompt / Secret Extraction blocked! user={} pattern='{}'", username, pattern);
                return AiAssistantResponse.builder()
                        .reply("⛔ Hệ thống không thể cung cấp cấu hình nội bộ, system prompt hoặc khóa bảo mật.")
                        .actionType("SECURITY_BLOCKED")
                        .executed(false)
                        .build();
            }
        }

        if (EXTRACTION_REGEX.matcher(norm).find()) {
            log.warn("AI System Prompt / Secret Extraction (regex) blocked! user={}", username);
            return AiAssistantResponse.builder()
                    .reply("⛔ Hệ thống không thể cung cấp cấu hình nội bộ, system prompt hoặc khóa bảo mật.")
                    .actionType("SECURITY_BLOCKED")
                    .executed(false)
                    .build();
        }

        if (CODE_INJECTION_PATTERN.matcher(rawMessage).find() || CODE_INJECTION_PATTERN.matcher(norm).find()) {
            log.warn("AI SQL/Script Injection blocked! user={}", username);
            return AiAssistantResponse.builder()
                    .reply("⛔ Yêu cầu chứa cú pháp câu lệnh không được phép và đã bị chặn bởi tường lửa AI.")
                    .actionType("SECURITY_BLOCKED")
                    .executed(false)
                    .build();
        }

        return null;
    }

    public String wrapUserQuery(String message) {
        if (message == null) {
            return "<user_input></user_input>";
        }
        String escaped = message.replace("<", "&lt;").replace(">", "&gt;");
        return "<user_input>" + escaped + "</user_input>";
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. PRE-LLM ZERO-TRUST CONTEXT SANITIZER
    // ─────────────────────────────────────────────────────────────────────────

    public String buildSanitizedLlmContext(String username, boolean isWorker, String currentRoute, Map<String, Object> lastContext) {
        List<Barn> allBarns = barnRepository.findAll();
        Set<Long> allowedBarnIds = isWorker ? workAssignmentService.barnIdsOf(username) : null;

        List<Barn> visibleBarns = isWorker
                ? allBarns.stream().filter(b -> allowedBarnIds.contains(b.getId())).toList()
                : allBarns;

        LocalDate today = LocalDate.now(CycleService.VN_ZONE);
        Map<Long, Integer> activeAgeByBarnId = new HashMap<>();
        if (cycleRepository != null) {
            for (FarmingCycle c : cycleRepository.findAllByStatus(CycleStatus.ACTIVE)) {
                if (c.getBarn() != null && c.getBarn().getId() != null) {
                    LocalDate refDate = c.getHatchDate() != null ? c.getHatchDate() : c.getStartDate();
                    if (refDate != null) {
                        int age = Math.max(1, (int) ChronoUnit.DAYS.between(refDate, today) + 1 + (c.getHatchDate() == null ? c.getCarriedDays() : 0));
                        activeAgeByBarnId.put(c.getBarn().getId(), age);
                    }
                }
            }
        }

        String barnSummary = visibleBarns.stream()
                .map(b -> {
                    Integer age = activeAgeByBarnId.get(b.getId());
                    String agePart = age != null ? (", activeCycleAgeDays:" + age) : "";
                    return String.format("{id:%d, name:'%s', area:'%s', status:'%s', currentQty:%d, capacity:%d%s}",
                            b.getId(),
                            b.getName(),
                            b.getArea() != null ? b.getArea().getName() : "",
                            b.getStatus(),
                            b.getCurrentQuantity(),
                            b.getCapacity(),
                            agePart);
                })
                .collect(Collectors.joining(", "));

        Set<Long> visibleAreaIds = visibleBarns.stream()
                .map(Barn::getArea)
                .filter(Objects::nonNull)
                .map(FarmArea::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        Set<Long> visibleWarehouseIds = new LinkedHashSet<>();
        if (isWorker) {
            for (Long areaId : visibleAreaIds) {
                warehouseRepository.findAllByArea_Id(areaId).forEach(w -> visibleWarehouseIds.add(w.getId()));
            }
        }

        List<InventoryItem> allItems = inventoryRepository.findAll();
        String inventorySummary = allItems.stream()
                .filter(i -> !isWorker || (i.getWarehouse() != null && visibleWarehouseIds.contains(i.getWarehouse().getId())))
                .limit(25)
                .map(i -> {
                    String prodName = i.getProduct() != null ? i.getProduct().getName() : "";
                    String whName = i.getWarehouse() != null ? i.getWarehouse().getName() : "";
                    String unitName = i.getUnit() != null ? i.getUnit().getName() : "";
                    if (isWorker) {
                        return String.format("{id:%d, name:'%s', warehouse:'%s', stock:%s, unit:'%s'}",
                                i.getId(), prodName, whName, i.getStock(), unitName);
                    }
                    return String.format("{id:%d, name:'%s', warehouse:'%s', stock:%s, price:%s, unit:'%s'}",
                            i.getId(), prodName, whName, i.getStock(), i.getPrice(), unitName);
                })
                .collect(Collectors.joining(", "));

        StringBuilder sb = new StringBuilder();
        if (currentRoute != null && currentRoute.matches(".*/barns/\\d+.*")) {
            Matcher m = Pattern.compile("/barns/(\\d+)").matcher(currentRoute);
            if (m.find()) {
                Long bId = Long.parseLong(m.group(1));
                if (!isWorker || allowedBarnIds.contains(bId)) {
                    barnRepository.findById(bId).ifPresent(activeBarn ->
                            sb.append("Người dùng đang xem trang của chuồng: ").append(activeBarn.getName())
                                    .append(" (ID: ").append(activeBarn.getId()).append(").\n"));
                }
            }
        }

        Map<String, Object> safeLastCtx = sanitizeLastContext(lastContext, isWorker);
        if (!safeLastCtx.isEmpty()) {
            sb.append("Ngữ cảnh thao tác trước đó: ").append(safeLastCtx).append("\n");
        }

        sb.append("Live Database Snapshot (Ngày hiện tại VN: ").append(today).append("):\n");
        sb.append("- Chuồng nuôi được phép truy cập (Barns): [").append(barnSummary).append("]\n");
        sb.append("- Vật tư kho (Inventory): [").append(inventorySummary).append("]\n");

        if (isWorker) {
            sb.append("- Phạm vi RBAC: ROLE_FARM_WORKER (MSG51/MSG60 — đã ẩn toàn bộ đơn giá, công nợ, lợi nhuận, hóa đơn và chuồng ngoài phân công).\n");
        } else {
            List<PurchaseInvoice> activeInvoices = invoiceRepository.findByStockStatusNot("Đã hủy");
            Map<Long, Long> invoiceDebtBySupplier = new HashMap<>();
            for (PurchaseInvoice inv : activeInvoices) {
                if (inv.getSupplier() != null && inv.getSupplier().getId() != null) {
                    long tot = inv.getTotalAmount() != null ? inv.getTotalAmount() : 0L;
                    long pd = inv.getPaidAmount() != null ? inv.getPaidAmount() : 0L;
                    invoiceDebtBySupplier.merge(inv.getSupplier().getId(), tot - pd, Long::sum);
                }
            }

            String supplierSummary = supplierRepository.findAll().stream()
                    .map(s -> {
                        long opening = s.getOpeningDebt() != null ? s.getOpeningDebt() : 0L;
                        long remaining = Math.max(0L, opening + invoiceDebtBySupplier.getOrDefault(s.getId(), 0L));
                        return String.format("{id:%d, code:'%s', name:'%s', phone:'%s', policy:'%s', remainingDebt:%d}",
                                s.getId(), s.getCode(), s.getName(), s.getPhone(), s.getPaymentPolicy(), remaining);
                    })
                    .collect(Collectors.joining(", "));

            String invoiceSummary = activeInvoices.stream()
                    .sorted((a, b) -> Long.compare(b.getId(), a.getId()))
                    .limit(10)
                    .map(inv -> String.format("{id:%d, code:'%s', supplier:'%s', total:%d, paid:%d, payStatus:'%s', stockStatus:'%s'}",
                            inv.getId(), inv.getCode(), inv.getSupplier() != null ? inv.getSupplier().getName() : "",
                            inv.getTotalAmount(), inv.getPaidAmount(), inv.getPaymentStatus(), inv.getStockStatus()))
                    .collect(Collectors.joining(", "));

            sb.append("- Nhà cung cấp & Công nợ (Suppliers): [").append(supplierSummary).append("]\n");
            sb.append("- Hóa đơn nhập gần nhất (Invoices): [").append(invoiceSummary).append("]\n");

            try {
                ReportSummaryResponse.FarmSummary fs = reportService.getSummary(null, null).farmSummary();
                if (fs != null) {
                    sb.append(String.format(
                            "- Tài chính tổng hợp: {realizedProfit:%s, wipCost:%s, wipRevenue:%s, totalRevenue:%s, totalCost:%s, closedCycles:%d, activeBarns:%d}\n",
                            fs.realizedProfit(), fs.wipCost(), fs.wipRevenue(), fs.totalRevenue(), fs.totalCost(), fs.closedCycles(), fs.activeBarns()));
                }
            } catch (Exception ex) {
                log.debug("Could not append report summary to AI context: {}", ex.getMessage());
            }
        }

        return sb.toString();
    }

    private Map<String, Object> sanitizeLastContext(Map<String, Object> lastContext, boolean isWorker) {
        if (lastContext == null || lastContext.isEmpty()) {
            return Collections.emptyMap();
        }
        Map<String, Object> out = new LinkedHashMap<>();
        lastContext.forEach((k, v) -> {
            if (!isWorker || !SENSITIVE_CTX_KEY.matcher(k).matches()) {
                out.put(k, v);
            }
        });
        return out;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. OUTPUT GUARDRAIL (Post-LLM Leak Scanner)
    // ─────────────────────────────────────────────────────────────────────────

    public AiAssistantResponse sanitizeOutput(AiAssistantResponse response, boolean isWorker) {
        if (response == null || response.getReply() == null) {
            return response;
        }
        String reply = response.getReply();
        reply = SECRET_MARKER_LEAK.matcher(reply).replaceAll("[REDACTED]");
        if (isWorker
                && !"RBAC_BLOCKED".equals(response.getActionType())
                && !"SECURITY_BLOCKED".equals(response.getActionType())
                && !"BARN_NOT_ASSIGNED".equals(response.getActionType())) {
            reply = WORKER_CURRENCY_LEAK.matcher(reply).replaceAll("[Đã ẩn theo RBAC]");
        }
        response.setReply(reply);
        return response;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. HMAC-SHA256 PENDING ACTION SIGNING & SINGLE-USE NONCE VERIFICATION
    // ─────────────────────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    public AiAssistantResponse signPendingAction(AiAssistantResponse response, String username, String role) {
        if (response == null || !response.isRequiresConfirmation() || response.getPendingAction() == null) {
            return response;
        }
        Map<String, Object> originalPending = response.getPendingAction();
        Object rawPayload = originalPending.get("payload");
        if (!(rawPayload instanceof Map<?, ?> rawMap)) {
            return response;
        }

        Map<String, Object> cleanPayload = stripTokenMeta((Map<String, Object>) rawMap);
        String actionType = String.valueOf(cleanPayload.getOrDefault("actionType",
                originalPending.getOrDefault("actionType", response.getActionType())));
        String actor = username != null && !username.isBlank() ? username : "anonymous";
        String effRole = role != null && !role.isBlank() ? role : "UNKNOWN";

        String actionId = UUID.randomUUID().toString();
        long expiresAt = System.currentTimeMillis() + ACTION_TOKEN_TTL_MS;
        String canonicalJson = canonicalJson(cleanPayload);
        String token = computeHmac(actionId, actor, effRole, actionType, canonicalJson, expiresAt);

        evictExpiredOrOverflow();
        pendingStore.put(actionId, new SignedPendingAction(
                actionId, actor, effRole, actionType, canonicalJson, cleanPayload, token, expiresAt
        ));

        Map<String, Object> signedPayload = new LinkedHashMap<>(cleanPayload);
        signedPayload.put("actionId", actionId);
        signedPayload.put("actionToken", token);
        signedPayload.put("expiresAt", expiresAt);

        Map<String, Object> signedPending = new LinkedHashMap<>(originalPending);
        signedPending.put("actionId", actionId);
        signedPending.put("actionToken", token);
        signedPending.put("expiresAt", expiresAt);
        signedPending.put("payload", signedPayload);

        response.setPendingAction(signedPending);
        return response;
    }

    public VerificationResult verifyAndConsumePendingAction(
            String actionId,
            String actionToken,
            Map<String, Object> submittedPayload,
            String username,
            String role
    ) {
        String effActionId = nonBlank(actionId)
                ? actionId.trim()
                : extractMeta(submittedPayload, "actionId");
        String effToken = nonBlank(actionToken)
                ? actionToken.trim()
                : extractMeta(submittedPayload, "actionToken");

        if (!nonBlank(effActionId) || !nonBlank(effToken)) {
            return VerificationResult.invalid(
                    "SECURITY_TOKEN_INVALID",
                    "⚠️ Thiếu chữ ký xác thực thao tác (actionId / actionToken). Vui lòng thực hiện lại câu lệnh."
            );
        }

        SignedPendingAction stored = pendingStore.get(effActionId);
        if (stored == null) {
            return VerificationResult.invalid(
                    "SECURITY_TOKEN_REPLAYED",
                    "⚠️ Thao tác xác nhận này đã được thực hiện trước đó hoặc không hợp lệ (chống gửi lặp Replay)."
            );
        }

        long now = System.currentTimeMillis();
        if (now > stored.expiresAt()) {
            pendingStore.remove(effActionId, stored);
            return VerificationResult.invalid(
                    "SECURITY_TOKEN_EXPIRED",
                    "⚠️ Thẻ xác nhận thao tác đã hết hạn (quá 5 phút). Vui lòng gửi lại câu lệnh mới."
            );
        }

        String actor = username != null && !username.isBlank() ? username : "anonymous";
        String effRole = role != null && !role.isBlank() ? role : "UNKNOWN";
        if (!Objects.equals(stored.username(), actor) || !Objects.equals(stored.role(), effRole)) {
            log.warn("AI action token owner/role mismatch! expected=({},{}) actual=({},{})",
                    stored.username(), stored.role(), actor, effRole);
            return VerificationResult.invalid(
                    "SECURITY_TOKEN_INVALID",
                    "⛔ Chữ ký thao tác không thuộc về tài khoản hoặc vai trò hiện tại."
            );
        }

        if (!constantTimeEquals(stored.actionToken(), effToken)) {
            log.warn("AI action token HMAC mismatch for actionId={} user={}", effActionId, actor);
            return VerificationResult.invalid(
                    "SECURITY_TOKEN_INVALID",
                    "⛔ Chữ ký HMAC-SHA256 của thẻ xác nhận không hợp lệ. Yêu cầu bị từ chối."
            );
        }

        if (submittedPayload != null && !submittedPayload.isEmpty()) {
            String submittedCanonical = canonicalJson(stripTokenMeta(submittedPayload));
            if (!Objects.equals(stored.canonicalParamsJson(), submittedCanonical)) {
                log.warn("AI PendingAction parameter tampering detected! actionId={} user={}", effActionId, actor);
                return VerificationResult.invalid(
                        "SECURITY_TOKEN_INVALID",
                        "⛔ Phát hiện tham số thao tác đã bị thay đổi so với bản gốc đã ký HMAC-SHA256. Hệ thống từ chối thực thi."
                );
            }
        }

        if (!pendingStore.remove(effActionId, stored)) {
            return VerificationResult.invalid(
                    "SECURITY_TOKEN_REPLAYED",
                    "⚠️ Thao tác xác nhận này đã được thực thi đồng thời ở yêu cầu khác (chống Replay)."
            );
        }

        return VerificationResult.valid(new LinkedHashMap<>(stored.canonicalPayload()));
    }

    private String computeHmac(String actionId, String username, String role, String actionType, String canonicalJson, long expiresAt) {
        String message = actionId + "|" + username + "|" + role + "|" + actionType + "|" + canonicalJson + "|" + expiresAt;
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(hmacSecretBytes, "HmacSHA256"));
            byte[] digest = mac.doFinal(message.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
        } catch (Exception ex) {
            throw new IllegalStateException("Cannot compute HMAC-SHA256 for AI action token", ex);
        }
    }

    private static boolean constantTimeEquals(String a, String b) {
        if (a == null || b == null) return false;
        return MessageDigest.isEqual(a.getBytes(StandardCharsets.UTF_8), b.getBytes(StandardCharsets.UTF_8));
    }

    private Map<String, Object> stripTokenMeta(Map<String, Object> map) {
        Map<String, Object> clean = new LinkedHashMap<>();
        if (map == null) return clean;
        map.forEach((k, v) -> {
            if (k != null && !TOKEN_META_KEYS.contains(k)) {
                clean.put(k, v);
            }
        });
        return clean;
    }

    private String canonicalJson(Map<String, Object> map) {
        try {
            Object normalized = normalizeValue(map);
            return objectMapper.writeValueAsString(normalized);
        } catch (Exception ex) {
            throw new IllegalStateException("Cannot serialize canonical pending action payload", ex);
        }
    }

    @SuppressWarnings("unchecked")
    private Object normalizeValue(Object value) {
        if (value == null) return null;
        if (value instanceof Map<?, ?> rawMap) {
            TreeMap<String, Object> sorted = new TreeMap<>();
            rawMap.forEach((k, v) -> {
                if (k != null) {
                    sorted.put(String.valueOf(k), normalizeValue(v));
                }
            });
            return sorted;
        }
        if (value instanceof Collection<?> col) {
            List<Object> list = new ArrayList<>();
            for (Object item : col) {
                list.add(normalizeValue(item));
            }
            return list;
        }
        if (value instanceof BigDecimal bd) {
            return canonicalNumberString(bd);
        }
        if (value instanceof Number num) {
            try {
                if (num instanceof Integer || num instanceof Long || num instanceof Short || num instanceof Byte) {
                    return String.valueOf(num.longValue());
                }
                return canonicalNumberString(new BigDecimal(num.toString()));
            } catch (Exception ignored) {
                return String.valueOf(num);
            }
        }
        return value;
    }

    private static String canonicalNumberString(BigDecimal bd) {
        BigDecimal stripped = bd.stripTrailingZeros();
        if (stripped.scale() < 0) {
            stripped = stripped.setScale(0);
        }
        return stripped.toPlainString();
    }

    private static String extractMeta(Map<String, Object> payload, String key) {
        if (payload == null) return null;
        Object val = payload.get(key);
        return val != null ? String.valueOf(val).trim() : null;
    }

    private static boolean nonBlank(String s) {
        return s != null && !s.isBlank();
    }

    private void evictExpiredOrOverflow() {
        long now = System.currentTimeMillis();
        pendingStore.entrySet().removeIf(e -> now > e.getValue().expiresAt());
        if (pendingStore.size() >= MAX_PENDING_ACTIONS) {
            int toDrop = pendingStore.size() - MAX_PENDING_ACTIONS + 100;
            Iterator<String> it = pendingStore.keySet().iterator();
            while (it.hasNext() && toDrop > 0) {
                it.next();
                it.remove();
                toDrop--;
            }
        }
    }

    public record SignedPendingAction(
            String actionId,
            String username,
            String role,
            String actionType,
            String canonicalParamsJson,
            Map<String, Object> canonicalPayload,
            String actionToken,
            long expiresAt
    ) {}

    public record VerificationResult(
            boolean valid,
            String errorCode,
            String errorMessage,
            Map<String, Object> canonicalPayload
    ) {
        public static VerificationResult valid(Map<String, Object> payload) {
            return new VerificationResult(true, null, null, payload);
        }

        public static VerificationResult invalid(String errorCode, String errorMessage) {
            return new VerificationResult(false, errorCode, errorMessage, null);
        }
    }
}
