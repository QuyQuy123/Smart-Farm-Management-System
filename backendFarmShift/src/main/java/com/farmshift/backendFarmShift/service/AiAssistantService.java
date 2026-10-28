package com.farmshift.backendFarmShift.service;

import com.farmshift.backendFarmShift.dto.AiAssistantRequest;
import com.farmshift.backendFarmShift.dto.AiAssistantResponse;
import com.farmshift.backendFarmShift.dto.request.BarnRequest;
import com.farmshift.backendFarmShift.dto.request.CloseCycleRequest;
import com.farmshift.backendFarmShift.dto.request.DailyTaskConfirmRequest;
import com.farmshift.backendFarmShift.dto.request.FarmAreaRequest;
import com.farmshift.backendFarmShift.dto.request.FlockTransferRequest;
import com.farmshift.backendFarmShift.dto.request.PurchasePaymentRequest;
import com.farmshift.backendFarmShift.dto.request.StartCycleRequest;
import com.farmshift.backendFarmShift.dto.request.SupplierRequest;
import com.farmshift.backendFarmShift.validation.ContactPhoneRules;
import com.farmshift.backendFarmShift.dto.response.BarnDayPlan;
import com.farmshift.backendFarmShift.entity.*;
import com.farmshift.backendFarmShift.repository.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.stereotype.Service;
import org.springframework.transaction.NestedTransactionNotSupportedException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.text.NumberFormat;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Slf4j
@Service
public class AiAssistantService {

    private final BarnRepository barnRepository;
    private final FarmingCycleRepository cycleRepository;
    private final FlockRepository flockRepository;
    private final FlockMovementRepository movementRepository;
    private final FeedRecordRepository feedRepository;
    private final WeightSampleRepository weightRepository;
    private final CycleExpenseRepository expenseRepository;
    private final PurchaseInvoiceRepository invoiceRepository;
    private final InventoryItemRepository inventoryRepository;
    private final SupplierRepository supplierRepository;
    private final PurchaseService purchaseService;
    private final DailyPlanService dailyPlanService;
    private final BarnService barnService;
    private final SupplierService supplierService;
    private final FarmAreaService farmAreaService;
    private final FarmAreaRepository areaRepository;
    private final ProductTypeRepository productTypeRepository;
    private final CycleService cycleService;
    private final FlockService flockService;
    private final PlatformTransactionManager txManager;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;

    /** Bộ nhớ ngữ cảnh hội thoại ngắn hạn theo người dùng (lastIntent, lastBarnId, lastItemName, lastInvoiceCode...). */
    private final Map<String, Map<String, Object>> lastContextByUser = new ConcurrentHashMap<>();
    private static final long CONTEXT_TTL_MILLIS = 30L * 60L * 1000L;

    private final String groqApiKey;
    private final String groqChatUrl;
    private final String groqChatModel;

    public AiAssistantService(
            BarnRepository barnRepository,
            FarmingCycleRepository cycleRepository,
            FlockRepository flockRepository,
            FlockMovementRepository movementRepository,
            FeedRecordRepository feedRepository,
            WeightSampleRepository weightRepository,
            CycleExpenseRepository expenseRepository,
            PurchaseInvoiceRepository invoiceRepository,
            InventoryItemRepository inventoryRepository,
            SupplierRepository supplierRepository,
            PurchaseService purchaseService,
            DailyPlanService dailyPlanService,
            BarnService barnService,
            SupplierService supplierService,
            FarmAreaService farmAreaService,
            FarmAreaRepository areaRepository,
            ProductTypeRepository productTypeRepository,
            CycleService cycleService,
            FlockService flockService,
            PlatformTransactionManager txManager,
            ObjectMapper objectMapper,
            @Value("${app.ai.groq-api-key:}") String groqApiKey,
            @Value("${app.ai.groq-chat-url:https://api.groq.com/openai/v1/chat/completions}") String groqChatUrl,
            @Value("${app.ai.groq-chat-model:llama-3.3-70b-versatile}") String groqChatModel
    ) {
        this.barnRepository = barnRepository;
        this.cycleRepository = cycleRepository;
        this.flockRepository = flockRepository;
        this.movementRepository = movementRepository;
        this.feedRepository = feedRepository;
        this.weightRepository = weightRepository;
        this.expenseRepository = expenseRepository;
        this.invoiceRepository = invoiceRepository;
        this.inventoryRepository = inventoryRepository;
        this.supplierRepository = supplierRepository;
        this.purchaseService = purchaseService;
        this.dailyPlanService = dailyPlanService;
        this.barnService = barnService;
        this.supplierService = supplierService;
        this.farmAreaService = farmAreaService;
        this.areaRepository = areaRepository;
        this.productTypeRepository = productTypeRepository;
        this.cycleService = cycleService;
        this.flockService = flockService;
        this.txManager = txManager;
        this.objectMapper = objectMapper;
        this.groqApiKey = groqApiKey != null ? groqApiKey.strip() : "";
        this.groqChatUrl = groqChatUrl != null && !groqChatUrl.isBlank() ? groqChatUrl.strip() : "https://api.groq.com/openai/v1/chat/completions";
        this.groqChatModel = groqChatModel != null && !groqChatModel.isBlank() ? groqChatModel.strip() : "llama-3.3-70b-versatile";

        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(10));
        requestFactory.setReadTimeout(Duration.ofSeconds(25));
        this.restTemplate = new RestTemplate(requestFactory);
    }

    @Transactional
    public AiAssistantResponse processRequest(AiAssistantRequest request, String username, Collection<? extends GrantedAuthority> authorities) {
        String actor = username != null && !username.isBlank() ? username : "anonymous";
        boolean isWorker = isWorkerOnly(authorities);

        // Check if this is an explicit confirmation of a pending action
        if (Boolean.TRUE.equals(request.getConfirmAction()) && request.getPendingActionPayload() != null) {
            AiAssistantResponse confirmed = executeConfirmedPayload(request.getPendingActionPayload(), username, isWorker);
            captureContext(actor, confirmed);
            return confirmed;
        }

        String rawMessage = request.getMessage() != null ? request.getMessage().trim() : "";
        if (rawMessage.isBlank()) {
            return AiAssistantResponse.builder()
                    .reply("Xin chào! Hãy ra lệnh bằng giọng nói hoặc nhập nội dung bạn cần hỗ trợ.")
                    .actionType("NONE")
                    .executed(false)
                    .build();
        }

        boolean autoExecute = request.getAutoExecute() == null || Boolean.TRUE.equals(request.getAutoExecute());

        // GIAI ĐOẠN 1: chuẩn hóa tiếng Việt đời thường (số bằng chữ, "500 nghìn", "2 bao cám", tên chuồng/đơn nói tắt...)
        String message = VietnameseSpeechNormalizer.normalizeVietnameseCommand(rawMessage);

        // Từ khóa xác nhận trực tiếp ("luôn nhé", "xác nhận luôn"): thực thi ngay, không cần thẻ xác nhận
        if (DIRECT_CONFIRM.matcher(message).find()) {
            autoExecute = true;
            message = DIRECT_CONFIRM.matcher(message).replaceAll(" ").replaceAll("\\s+", " ").trim();
        }
        Env env = new Env(actor, isWorker, autoExecute);
        Map<String, Object> ctx = resolveContext(actor, request.getLastActionContext());

        // GIAI ĐOẠN 1b: Điều hướng màn hình thuần túy ("mở ghi nhật ký", "sổ quỹ"...) — chạy TRƯỚC các engine thao tác dữ liệu
        AssistantNavigationRouter.Route navRoute = AssistantNavigationRouter.resolve(normalizeText(message));
        if (navRoute != null) {
            AiAssistantResponse navResponse = AiAssistantResponse.builder()
                    .reply("🚀 Đang chuyển bạn sang màn hình **" + navRoute.label() + "**.")
                    .actionType("NAVIGATE_AND_PREFILL")
                    .executed(true)
                    .navigateTo(navRoute.path())
                    .build();
            captureContext(actor, navResponse);
            return navResponse;
        }

        // GIAI ĐOẠN 2a: Multi-Intent Fuzzy Engine — sửa/cập nhật bản ghi, công nợ, vật tư, nhà cung cấp, lứa nuôi, chuyển đàn
        AiAssistantResponse mutation = withDiffDetails(evaluateMutationEngine(message, rawMessage, request.getCurrentRoute(), env, ctx));
        if (mutation != null) {
            captureContext(actor, mutation);
            return mutation;
        }

        // GIAI ĐOẠN 2b: luật tạo mới truyền thống (ghi cám/cân mẫu/hao hụt/chi phí, tạo chuồng, nhập kho theo mã...)
        AiAssistantResponse ruleResult = withDiffDetails(evaluateRuleEngine(message, request.getCurrentRoute(), username, isWorker, autoExecute));
        if (ruleResult != null) {
            captureContext(actor, ruleResult);
            return ruleResult;
        }

        // GIAI ĐOẠN 2c: Groq LLM JSON Mode + Live Database Snapshot khi câu lệnh phức tạp hơn các luật cục bộ
        if (!groqApiKey.isBlank()) {
            try {
                AiAssistantResponse llmResult = withDiffDetails(evaluateLlmEngine(message, request.getCurrentRoute(), request.getHistory(), env, ctx));
                if (llmResult != null) {
                    captureContext(actor, llmResult);
                    return llmResult;
                }
            } catch (Exception e) {
                log.warn("Groq LLM intent engine encountered error: {}", e.getMessage());
            }
        }

        // Smart fallback response with local veterinary and farming knowledge
        return getSmartFallbackResponse(rawMessage);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // PENDING ACTION CARD: giá trị cũ → giá trị mới, xác nhận trước khi ghi DB
    // ─────────────────────────────────────────────────────────────────────────────

    /** Từ khóa xác nhận trực tiếp trong câu lệnh: thực thi ngay không cần bấm nút Xác nhận. */
    private static final Pattern DIRECT_CONFIRM = Pattern.compile(
            "(?iu)(?<![\\p{L}])(?:xác\\s+nhận\\s+luôn|thực\\s+hiện\\s+luôn|chốt\\s+luôn|lưu\\s+luôn|làm\\s+luôn|luôn\\s+nhé|luôn\\s+nha|luôn\\s+đi|luôn)(?![\\p{L}])");

    private static String vn(Object number) {
        return number == null ? "-" : NumberFormat.getInstance(new Locale("vi", "VN")).format(number);
    }

    private static String change(Object oldValue, Object newValue, String unit) {
        String suffix = unit == null || unit.isBlank() ? "" : " " + unit;
        return (oldValue == null ? "-" : oldValue) + suffix + " → " + newValue + suffix;
    }

    /** Gắn bảng "cũ → mới" vào thẻ xác nhận của mọi thao tác SỬA để người dùng nhìn rõ trước khi bấm Xác nhận. */
    @SuppressWarnings("unchecked")
    private AiAssistantResponse withDiffDetails(AiAssistantResponse response) {
        if (response == null || !response.isRequiresConfirmation() || response.getPendingAction() == null) return response;
        Object payload = response.getPendingAction().get("payload");
        if (!(payload instanceof Map<?, ?> map)) return response;
        Map<String, Object> diff;
        try {
            diff = diffDetails((Map<String, Object>) map);
        } catch (Exception ex) {
            log.debug("Không dựng được bảng so sánh cũ/mới: {}", ex.getMessage());
            return response;
        }
        if (diff.isEmpty()) return response;
        Map<String, Object> pending = new LinkedHashMap<>(response.getPendingAction());
        pending.put("details", diff);
        response.setPendingAction(pending);
        return response;
    }

    private Map<String, Object> diffDetails(Map<String, Object> payload) {
        Map<String, Object> d = new LinkedHashMap<>();
        String type = String.valueOf(payload.getOrDefault("actionType", ""));
        switch (type) {
            case "UPDATE_BARN_INFO": {
                Barn barn = payload.get("barnId") != null ? barnRepository.findById(Long.valueOf(String.valueOf(payload.get("barnId")))).orElse(null) : null;
                if (barn == null) return d;
                d.put("Chuồng nuôi", barn.getName());
                if (payload.containsKey("name")) d.put("Tên chuồng", change(barn.getName(), payload.get("name"), null));
                if (payload.containsKey("capacity")) d.put("Sức chứa", change(vn(barn.getCapacity()), vn(Integer.valueOf(String.valueOf(payload.get("capacity")))), "con"));
                if (payload.containsKey("areaM2")) d.put("Diện tích", change(barn.getAreaM2(), payload.get("areaM2"), "m²"));
                if (payload.containsKey("targetWeight")) d.put("Cân nặng mục tiêu", change(barn.getTargetWeight(), payload.get("targetWeight"), "kg"));
                return d;
            }
            case "UPDATE_INVENTORY_ITEM": {
                InventoryItem item = payload.get("itemId") != null ? inventoryRepository.findById(Long.valueOf(String.valueOf(payload.get("itemId")))).orElse(null) : null;
                if (item == null) return d;
                d.put("Vật tư", item.getProduct() != null ? item.getProduct().getName() : "Vật tư");
                if (payload.containsKey("price")) d.put("Đơn giá", change(vn(item.getPrice()), vn(Double.valueOf(String.valueOf(payload.get("price"))).longValue()), "đ"));
                if (payload.containsKey("stock")) d.put("Tồn kho", change(item.getStock(), payload.get("stock"), item.getUnit() != null ? item.getUnit().getName() : ""));
                return d;
            }
            case "UPDATE_SUPPLIER_INFO": {
                Supplier s = payload.get("supplierId") != null ? supplierRepository.findById(Long.valueOf(String.valueOf(payload.get("supplierId")))).orElse(null) : null;
                if (s == null) return d;
                d.put("Nhà cung cấp", s.getName());
                if (payload.containsKey("phone")) d.put("Số điện thoại", change(s.getPhone(), payload.get("phone"), null));
                if (payload.containsKey("address")) d.put("Địa chỉ", change(s.getAddress(), payload.get("address"), null));
                if (payload.containsKey("representative")) d.put("Người đại diện", change(s.getRepresentative(), payload.get("representative"), null));
                if (payload.containsKey("paymentPolicy")) d.put("Chính sách thanh toán", change(s.getPaymentPolicy(), payload.get("paymentPolicy"), null));
                if (payload.containsKey("openingDebt")) d.put("Công nợ đầu kỳ", change(vn(s.getOpeningDebt()), vn(Long.valueOf(String.valueOf(payload.get("openingDebt")))), "đ"));
                return d;
            }
            case "PAY_PURCHASE_INVOICE": {
                PurchaseInvoice inv = payload.get("invoiceId") != null ? invoiceRepository.findById(Long.valueOf(String.valueOf(payload.get("invoiceId")))).orElse(null)
                        : invoiceRepository.findByCode(String.valueOf(payload.get("invoiceCode"))).orElse(null);
                if (inv == null) return d;
                long amount = Long.parseLong(String.valueOf(payload.getOrDefault("amount", 0)));
                long remain = Math.max(0, inv.getTotalAmount() - inv.getPaidAmount());
                d.put("Hóa đơn", inv.getCode());
                d.put("Đã thanh toán", change(vn(inv.getPaidAmount()), vn(inv.getPaidAmount() + amount), "đ"));
                d.put("Còn nợ", change(vn(remain), vn(Math.max(0, remain - amount)), "đ"));
                return d;
            }
            case "UPDATE_FEED": {
                FeedRecord record = findFeedRecordForUpdate(payload);
                if (record == null) return d;
                Barn b = record.getCycle() != null ? record.getCycle().getBarn() : null;
                d.put("Chuồng nuôi", b != null ? b.getName() : "-");
                d.put("Loại cám", record.getFeedName() != null ? record.getFeedName() : "-");
                d.put("Lượng cám", change(record.getQuantityKg(), payload.get("newKg"), "kg"));
                return d;
            }
            case "UPDATE_WEIGHT": {
                WeightSample sample = findWeightSampleForUpdate(payload);
                if (sample == null) return d;
                Barn b = sample.getCycle() != null ? sample.getCycle().getBarn() : null;
                d.put("Chuồng nuôi", b != null ? b.getName() : "-");
                d.put("Cân nặng TB", change(sample.getAvgWeightKg(), payload.get("avgWeight"), "kg/con"));
                if (payload.containsKey("sampleSize")) d.put("Số con cân mẫu", change(sample.getSampleSize(), payload.get("sampleSize"), "con"));
                return d;
            }
            case "UPDATE_MORTALITY": {
                FlockMovement m = findMovementForUpdate(payload);
                if (m == null) return d;
                int newQty = Integer.parseInt(String.valueOf(payload.get("quantity")));
                Barn b = m.getFlock() != null && m.getFlock().getCycle() != null ? m.getFlock().getCycle().getBarn() : null;
                d.put("Chuồng nuôi", b != null ? b.getName() : "-");
                d.put("Loại biến động", movementLabel(m.getType()));
                d.put("Số lượng", change(m.getQuantity(), newQty, "con"));
                if (b != null) d.put("Đàn còn lại", change(vn(b.getCurrentQuantity()), vn(Math.max(0, b.getCurrentQuantity() - (newQty - m.getQuantity()))), "con"));
                return d;
            }
            default:
                return d;
        }
    }

    private static String movementLabel(FlockMovementType type) {
        if (type == null) return "-";
        return switch (type) {
            case DEATH -> "Hao hụt / chết";
            case CULL -> "Loại thải";
            case HARVEST -> "Xuất bán";
            case TRANSFER_IN -> "Chuyển đến";
            case TRANSFER_OUT -> "Chuyển đi";
            case IMPORT -> "Nhập đàn";
        };
    }

    private FeedRecord findFeedRecordForUpdate(Map<String, Object> payload) {
        Long recordId = payload.get("recordId") != null ? Long.valueOf(String.valueOf(payload.get("recordId"))) : null;
        FeedRecord record = recordId != null ? feedRepository.findById(recordId).orElse(null) : null;
        if (record == null && payload.get("barnId") != null) {
            Long barnId = Long.valueOf(String.valueOf(payload.get("barnId")));
            record = feedRepository.findAllByCycleIdOrderByRecordDateDescIdDesc(
                    cycleRepository.findFirstByBarnIdAndStatus(barnId, CycleStatus.ACTIVE).map(FarmingCycle::getId).orElse(0L)
            ).stream().findFirst().orElse(null);
        }
        return record;
    }

    private WeightSample findWeightSampleForUpdate(Map<String, Object> payload) {
        Long sampleId = payload.get("sampleId") != null ? Long.valueOf(String.valueOf(payload.get("sampleId"))) : null;
        WeightSample sample = sampleId != null ? weightRepository.findById(sampleId).orElse(null) : null;
        if (sample == null && payload.get("barnId") != null) {
            Long barnId = Long.valueOf(String.valueOf(payload.get("barnId")));
            sample = weightRepository.findAllByCycleIdOrderBySampleDateDescIdDesc(
                    cycleRepository.findFirstByBarnIdAndStatus(barnId, CycleStatus.ACTIVE).map(FarmingCycle::getId).orElse(0L)
            ).stream().findFirst().orElse(null);
        }
        return sample;
    }

    /**
     * Tìm bản ghi biến động đàn (chết / loại thải / xuất bán) cần sửa. Nếu payload có {@code movementType}
     * (DEATH | CULL | HARVEST) thì chỉ xét đúng loại đó; ngược lại lấy bản ghi hao hụt gần nhất của chuồng.
     */
    private FlockMovement findMovementForUpdate(Map<String, Object> payload) {
        Long movementId = payload.get("movementId") != null ? Long.valueOf(String.valueOf(payload.get("movementId"))) : null;
        FlockMovement movement = movementId != null ? movementRepository.findById(movementId).orElse(null) : null;
        if (movement != null || payload.get("barnId") == null) return movement;
        Long barnId = Long.valueOf(String.valueOf(payload.get("barnId")));
        FlockMovementType wanted = null;
        if (payload.get("movementType") != null) {
            try {
                wanted = FlockMovementType.valueOf(String.valueOf(payload.get("movementType")));
            } catch (IllegalArgumentException ignored) {
                // dùng mặc định
            }
        }
        final FlockMovementType filter = wanted;
        Optional<FarmingCycle> activeCycle = cycleRepository.findFirstByBarnIdAndStatus(barnId, CycleStatus.ACTIVE);
        if (activeCycle.isPresent()) {
            return movementRepository.findAllByFlock_Cycle_IdOrderByMovementDateAscIdAsc(activeCycle.get().getId()).stream()
                    .filter(m -> filter != null ? m.getType() == filter : (m.getType() == FlockMovementType.DEATH || m.getType() == FlockMovementType.CULL))
                    .max(Comparator.comparing(FlockMovement::getId))
                    .orElse(null);
        }
        return movementRepository.findAll().stream()
                .filter(m -> filter != null ? m.getType() == filter : (m.getType() == FlockMovementType.DEATH || m.getType() == FlockMovementType.CULL))
                .filter(m -> m.getFlock() != null && m.getFlock().getCycle() != null && barnId.equals(m.getFlock().getCycle().getBarn().getId()))
                .max(Comparator.comparing(FlockMovement::getId))
                .orElse(null);
    }

    /** Nếu {@code auto} → ghi DB ngay; ngược lại trả Pending Action Card để người dùng xác nhận. */
    private AiAssistantResponse confirmOrExecute(Map<String, Object> payload, String title, String question, boolean auto, String username) {
        if (auto) return executeMutationPayload(payload, username);
        String type = String.valueOf(payload.get("actionType"));
        return AiAssistantResponse.builder()
                .reply(question)
                .actionType(type)
                .executed(false)
                .requiresConfirmation(true)
                .pendingAction(Map.of("actionType", type, "title", title, "payload", payload))
                .build();
    }

    /**
     * Phân quyền RBAC: chỉ Chủ trại / Kế toán / Admin mới được thao tác quản trị & tài chính.
     * Request không có Authentication (authorities == null) hoặc chỉ có ROLE_FARM_WORKER được coi là Công nhân.
     */
    private static boolean isWorkerOnly(Collection<? extends GrantedAuthority> authorities) {
        if (authorities == null) return true;
        boolean privileged = authorities.stream().anyMatch(a -> {
            String role = a.getAuthority() == null ? "" : a.getAuthority().toUpperCase(Locale.ROOT);
            return role.equals("ROLE_FARM_OWNER") || role.equals("ROLE_ACCOUNTANT") || role.equals("ROLE_ADMIN");
        });
        return !privileged;
    }

    private record Env(String user, boolean worker, boolean auto) {
    }

    public static final Set<String> WORKER_BLOCKED_ACTIONS = Set.of(
            "UPDATE_BARN_INFO",
            "CREATE_BARN",
            "CREATE_BARN_OR_AREA",
            "CREATE_AREA",
            "UPDATE_INVENTORY_ITEM",
            "UPDATE_SUPPLIER_INFO",
            "CREATE_SUPPLIER",
            "PAY_PURCHASE_INVOICE",
            "CANCEL_PURCHASE_INVOICE",
            "LOG_EXPENSE",
            "LOG_OR_UPDATE_EXPENSE",
            "UPDATE_EXPENSE",
            "TRANSFER_FLOCK",
            "START_CYCLE",
            "CLOSE_CYCLE",
            "START_OR_CLOSE_CYCLE"
    );

    private AiAssistantResponse workerBlocked(String actionType) {
        return AiAssistantResponse.builder()
                .reply("⚠️ Tài khoản Công nhân không có quyền thực hiện thao tác này. Vui lòng liên hệ Kế toán hoặc Chủ trại.")
                .actionType(actionType)
                .executed(false)
                .build();
    }

    private void captureContext(String actor, AiAssistantResponse response) {
        if (response == null || actor == null) return;
        Map<String, Object> ctx = response.getActionContext();
        if (ctx == null && response.getActionSummary() != null) {
            ctx = new LinkedHashMap<>(response.getActionSummary());
        }
        if (ctx == null) {
            ctx = new LinkedHashMap<>();
        } else {
            ctx = new LinkedHashMap<>(ctx);
        }
        if (response.getActionType() != null && !"NONE".equalsIgnoreCase(response.getActionType()) && !"GENERAL_QNA".equalsIgnoreCase(response.getActionType())) {
            ctx.put("lastIntent", response.getActionType());
        }
        if (!ctx.isEmpty()) {
            ctx.put("_updatedAt", System.currentTimeMillis());
            lastContextByUser.put(actor, ctx);
            response.setActionContext(ctx);
        }
    }

    private Map<String, Object> resolveContext(String actor, Map<String, Object> clientContext) {
        Map<String, Object> merged = new LinkedHashMap<>();
        if (actor != null && lastContextByUser.containsKey(actor)) {
            Map<String, Object> cached = lastContextByUser.get(actor);
            Long updatedAt = (Long) cached.get("_updatedAt");
            if (updatedAt == null || (System.currentTimeMillis() - updatedAt <= CONTEXT_TTL_MILLIS)) {
                merged.putAll(cached);
            } else {
                lastContextByUser.remove(actor);
            }
        }
        if (clientContext != null) {
            merged.putAll(clientContext);
        }
        return merged;
    }

    private AiAssistantResponse evaluateMutationEngine(String message, String rawMessage, String currentRoute, Env env, Map<String, Object> ctx) {
        String norm = normalizeText(message);

        // 1. UPDATE_BARN_INFO (Sửa thông tin chuồng nuôi: sức chứa, diện tích, mục tiêu cân nặng, tên chuồng)
        boolean isBarnInfoUpdate = ((norm.contains("suc chua") || norm.contains("dien tich") || norm.contains("muc tieu can") || norm.contains("trong luong muc tieu"))
                && (norm.contains("sua") || norm.contains("doi") || norm.contains("cap nhat") || norm.contains("chinh") || norm.contains("thay doi") || norm.contains("tang") || norm.contains("giam") || norm.contains("len") || norm.contains("xuong") || norm.contains("thanh")))
                || ((norm.contains("doi ten") || norm.contains("sua ten") || norm.contains("dat ten")) && (norm.contains("chuong") || norm.contains("nha")));
        if (isBarnInfoUpdate) {
            if (env.worker()) {
                return workerBlocked("UPDATE_BARN_INFO");
            }
            Barn barn = resolveBarn(norm, message, currentRoute);
            if (barn == null && ctx.get("barnId") != null) {
                barn = barnRepository.findById(Long.valueOf(String.valueOf(ctx.get("barnId")))).orElse(null);
            }
            if (barn == null) {
                return barnNotFoundResponse(norm);
            }

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("actionType", "UPDATE_BARN_INFO");
            payload.put("barnId", barn.getId());
            payload.put("barnName", barn.getName());

            // Extract new name
            if (norm.contains("doi ten") || norm.contains("sua ten") || norm.contains("dat ten")) {
                Matcher nameMatcher = Pattern.compile("(?:doi ten|sua ten|dat ten)\\s*(?:chuong|nha)?\\s*[^\\s]+\\s*(?:thanh|sang|la)\\s+(.+)$", Pattern.CASE_INSENSITIVE).matcher(rawMessage != null ? rawMessage : message);
                if (nameMatcher.find()) {
                    payload.put("name", nameMatcher.group(1).trim());
                } else {
                    Matcher altNameMatcher = Pattern.compile("(?:thanh|sang|la)\\s+([^.,;!?]+)$", Pattern.CASE_INSENSITIVE).matcher(rawMessage != null ? rawMessage : message);
                    if (altNameMatcher.find()) {
                        payload.put("name", altNameMatcher.group(1).trim());
                    }
                }
            }

            // Extract capacity
            Matcher capMatcher = Pattern.compile("(?:suc chua|chua|nuoi)\\s*(?:la|duoc|len|thanh|tam|duoc)?\\s*(\\d+)", Pattern.CASE_INSENSITIVE).matcher(norm);
            if (capMatcher.find()) {
                payload.put("capacity", Integer.parseInt(capMatcher.group(1)));
            } else {
                Matcher conMatcher = Pattern.compile("(\\d+)\\s*(?:con|cho|ga)", Pattern.CASE_INSENSITIVE).matcher(norm);
                if (conMatcher.find()) {
                    payload.put("capacity", Integer.parseInt(conMatcher.group(1)));
                }
            }

            // Extract floorArea
            Matcher areaMatcher = Pattern.compile("(?:dien tich|rong)\\s*(?:la|len|thanh)?\\s*(\\d+(?:[.,]\\d+)?)\\s*(?:m2|m|met)?", Pattern.CASE_INSENSITIVE).matcher(norm);
            if (areaMatcher.find()) {
                payload.put("areaM2", Double.parseDouble(areaMatcher.group(1).replace(',', '.')));
            } else {
                Matcher m2Matcher = Pattern.compile("(\\d+(?:[.,]\\d+)?)\\s*(?:m2|met vuong)", Pattern.CASE_INSENSITIVE).matcher(norm);
                if (m2Matcher.find()) {
                    payload.put("areaM2", Double.parseDouble(m2Matcher.group(1).replace(',', '.')));
                }
            }

            // Extract targetWeight
            Matcher weightMatcher = Pattern.compile("(?:muc tieu can|trong luong muc tieu|muc tieu)\\s*(?:la|thanh)?\\s*(\\d+(?:[.,]\\d+)?)", Pattern.CASE_INSENSITIVE).matcher(norm);
            if (weightMatcher.find()) {
                double newWeight = Double.parseDouble(weightMatcher.group(1).replace(',', '.'));
                payload.put("targetWeight", newWeight);
            }

            if (!payload.containsKey("capacity") && !payload.containsKey("areaM2") && !payload.containsKey("targetWeight") && !payload.containsKey("name")) {
                Matcher anyNum = Pattern.compile("(\\d+(?:[.,]\\d+)?)").matcher(norm);
                if (anyNum.find()) {
                    if (norm.contains("suc chua")) {
                        payload.put("capacity", Integer.parseInt(anyNum.group(1)));
                    } else if (norm.contains("dien tich")) {
                        payload.put("areaM2", Double.parseDouble(anyNum.group(1).replace(',', '.')));
                    }
                }
            }

            if (!env.auto()) {
                Map<String, Object> details = new LinkedHashMap<>();
                details.put("Chuồng nuôi", barn.getName());
                if (payload.containsKey("name")) details.put("Tên chuồng mới", payload.get("name"));
                if (payload.containsKey("capacity")) details.put("Sức chứa mới", payload.get("capacity") + " con");
                if (payload.containsKey("areaM2")) details.put("Diện tích mới", payload.get("areaM2") + " m²");
                if (payload.containsKey("targetWeight")) details.put("Trọng lượng mục tiêu", payload.get("targetWeight") + " kg");

                return AiAssistantResponse.builder()
                        .reply("Bạn có muốn cập nhật thông tin cho **" + barn.getName() + "** không?")
                        .actionType("UPDATE_BARN_INFO")
                        .executed(false)
                        .requiresConfirmation(true)
                        .pendingAction(Map.of(
                                "actionType", "UPDATE_BARN_INFO",
                                "title", "Cập nhật thông tin: " + barn.getName(),
                                "details", details,
                                "payload", payload
                        ))
                        .build();
            }

            return executeMutationPayload(payload, env.user());
        }

        // 2. UPDATE_INVENTORY_ITEM (Sửa đơn giá hoặc điều chỉnh tồn kho vật tư)
        if (((norm.contains("gia") || norm.contains("don gia") || norm.contains("gia ban") || norm.contains("gia mua"))
                && (norm.contains("sua") || norm.contains("doi") || norm.contains("cap nhat") || norm.contains("chinh") || norm.contains("len") || norm.contains("xuong") || norm.contains("thanh")))
                || ((norm.contains("ton kho") || norm.contains("so luong ton")) && (norm.contains("dieu chinh") || norm.contains("sua") || norm.contains("doi") || norm.contains("cap nhat")))) {
            if (env.worker()) {
                return workerBlocked("UPDATE_INVENTORY_ITEM");
            }
            List<InventoryItem> items = inventoryRepository.findAll();
            InventoryItem matched = FuzzyEntityResolver.findEntityInText(message, items, i -> i.getProduct() != null ? i.getProduct().getName() : "", 0.35);
            if (matched == null && ctx.get("itemId") != null) {
                matched = inventoryRepository.findById(Long.valueOf(String.valueOf(ctx.get("itemId")))).orElse(null);
            }
            if (matched != null) {
                Map<String, Object> payload = new LinkedHashMap<>();
                payload.put("actionType", "UPDATE_INVENTORY_ITEM");
                payload.put("itemId", matched.getId());
                payload.put("productName", matched.getProduct() != null ? matched.getProduct().getName() : "");

                if (norm.contains("gia") || norm.contains("don gia") || norm.contains("gia ban") || norm.contains("gia mua")) {
                    Matcher priceMatcher = Pattern.compile("(?:thanh|len|xuong|la|gia)?\\s*(\\d{4,10})").matcher(norm);
                    if (priceMatcher.find()) {
                        payload.put("price", Double.parseDouble(priceMatcher.group(1)));
                    } else {
                        Matcher anyPrice = Pattern.compile("(\\d{4,10})").matcher(norm);
                        if (anyPrice.find()) {
                            payload.put("price", Double.parseDouble(anyPrice.group(1)));
                        }
                    }
                } else {
                    Matcher stockMatcher = Pattern.compile("(?:len|xuong|thanh|la|ton)?\\s*(\\d+(?:[.,]\\d+)?)").matcher(norm);
                    if (stockMatcher.find()) {
                        payload.put("stock", Double.parseDouble(stockMatcher.group(1).replace(',', '.')));
                    }
                }

                if (!env.auto()) {
                    String pName = matched.getProduct() != null ? matched.getProduct().getName() : "Vật tư";
                    return AiAssistantResponse.builder()
                            .reply("Bạn có chắc chắn muốn cập nhật vật tư **" + pName + "** không?")
                            .actionType("UPDATE_INVENTORY_ITEM")
                            .executed(false)
                            .requiresConfirmation(true)
                            .pendingAction(Map.of(
                                    "actionType", "UPDATE_INVENTORY_ITEM",
                                    "title", "Cập nhật vật tư: " + pName,
                                    "payload", payload
                            ))
                            .build();
                }

                return executeMutationPayload(payload, env.user());
            }
        }

        // 3. UPDATE_SUPPLIER_INFO (Sửa thông tin Nhà cung cấp: SĐT, chính sách thanh toán...)
        if (((norm.contains("nha cung cap") || norm.contains("ncc") || norm.contains("doi tac") || norm.contains("dai ly"))
                && (norm.contains("sua") || norm.contains("doi") || norm.contains("cap nhat") || norm.contains("chinh") || norm.contains("sdt") || norm.contains("so dien thoai") || norm.contains("chinh sach")))
                || norm.contains("chinh sach thanh toan") || norm.contains("so dien thoai ncc") || norm.contains("sdt ncc")) {
            if (env.worker()) {
                return workerBlocked("UPDATE_SUPPLIER_INFO");
            }
            List<Supplier> suppliers = supplierRepository.findAll();
            Supplier matched = FuzzyEntityResolver.findEntityInText(message, suppliers, Supplier::getName, 0.35);
            if (matched == null && ctx.get("supplierId") != null) {
                matched = supplierRepository.findById(Long.valueOf(String.valueOf(ctx.get("supplierId")))).orElse(null);
            }
            if (matched != null) {
                Map<String, Object> payload = new LinkedHashMap<>();
                payload.put("actionType", "UPDATE_SUPPLIER_INFO");
                payload.put("supplierId", matched.getId());
                payload.put("supplierName", matched.getName());

                Matcher phoneMatcher = Pattern.compile("(0\\d{8,11})").matcher(norm);
                if (phoneMatcher.find()) {
                    payload.put("phone", phoneMatcher.group(1));
                }
                if (norm.contains("tra sau")) {
                    payload.put("paymentPolicy", "Trả sau");
                } else if (norm.contains("tra truoc")) {
                    payload.put("paymentPolicy", "Trả trước");
                }

                if (!env.auto()) {
                    return AiAssistantResponse.builder()
                            .reply("Bạn có muốn cập nhật thông tin nhà cung cấp **" + matched.getName() + "** không?")
                            .actionType("UPDATE_SUPPLIER_INFO")
                            .executed(false)
                            .requiresConfirmation(true)
                            .pendingAction(Map.of(
                                    "actionType", "UPDATE_SUPPLIER_INFO",
                                    "title", "Cập nhật NCC: " + matched.getName(),
                                    "payload", payload
                            ))
                            .build();
                }

                return executeMutationPayload(payload, env.user());
            }
        }

        // 4. PAY_PURCHASE_INVOICE (Thanh toán công nợ hóa đơn nhập)
        if (norm.contains("thanh toan") || norm.contains("tra no") || norm.contains("tra het no") || norm.contains("tra tien don") || (norm.contains("tra") && norm.contains("cho don"))) {
            if (env.worker()) {
                return workerBlocked("PAY_PURCHASE_INVOICE");
            }
            Matcher codeMatcher = Pattern.compile("nh\\s*[-_]?\\s*(\\d+)", Pattern.CASE_INSENSITIVE).matcher(norm);
            String invoiceCode = null;
            if (codeMatcher.find()) {
                invoiceCode = String.format(Locale.ROOT, "NH%06d", Integer.parseInt(codeMatcher.group(1)));
            } else if (ctx.get("invoiceCode") != null) {
                invoiceCode = String.valueOf(ctx.get("invoiceCode"));
            }
            if (invoiceCode != null) {
                Optional<PurchaseInvoice> invOpt = invoiceRepository.findByCode(invoiceCode);
                if (invOpt.isPresent()) {
                    PurchaseInvoice inv = invOpt.get();
                    long amount = 0;
                    if (norm.contains("tra het") || norm.contains("toan bo")) {
                        amount = Math.max(0, inv.getTotalAmount() - inv.getPaidAmount());
                    } else {
                        Matcher numMatcher = Pattern.compile("(\\d{5,12})").matcher(norm);
                        if (numMatcher.find()) {
                            amount = Long.parseLong(numMatcher.group(1));
                        } else {
                            amount = Math.max(0, inv.getTotalAmount() - inv.getPaidAmount());
                        }
                    }

                    Map<String, Object> payload = new LinkedHashMap<>();
                    payload.put("actionType", "PAY_PURCHASE_INVOICE");
                    payload.put("invoiceCode", inv.getCode());
                    payload.put("invoiceId", inv.getId());
                    payload.put("amount", amount);

                    if (!env.auto()) {
                        String moneyFormatted = NumberFormat.getInstance(new Locale("vi", "VN")).format(amount) + " đ";
                        return AiAssistantResponse.builder()
                                .reply("Bạn có muốn thanh toán **" + moneyFormatted + "** cho đơn hàng **" + inv.getCode() + "** không?")
                                .actionType("PAY_PURCHASE_INVOICE")
                                .executed(false)
                                .requiresConfirmation(true)
                                .pendingAction(Map.of(
                                        "actionType", "PAY_PURCHASE_INVOICE",
                                        "title", "Thanh toán hóa đơn: " + inv.getCode(),
                                        "payload", payload
                                ))
                                .build();
                    }

                    return executeMutationPayload(payload, env.user());
                }
            }
        }

        // 5. CANCEL_PURCHASE_INVOICE (Hủy hóa đơn nhập hàng)
        if ((norm.contains("huy don") || norm.contains("huy hoa don") || norm.contains("xoa don")) && (norm.contains("nh") || norm.contains("nhap") || norm.matches(".*\\bnh\\d+.*"))) {
            if (env.worker()) {
                return workerBlocked("CANCEL_PURCHASE_INVOICE");
            }
            Matcher codeMatcher = Pattern.compile("nh\\s*[-_]?\\s*(\\d+)", Pattern.CASE_INSENSITIVE).matcher(norm);
            String invoiceCode = null;
            if (codeMatcher.find()) {
                invoiceCode = String.format(Locale.ROOT, "NH%06d", Integer.parseInt(codeMatcher.group(1)));
            } else if (ctx.get("invoiceCode") != null) {
                invoiceCode = String.valueOf(ctx.get("invoiceCode"));
            }
            if (invoiceCode != null) {
                Optional<PurchaseInvoice> invOpt = invoiceRepository.findByCode(invoiceCode);
                if (invOpt.isPresent()) {
                    Map<String, Object> payload = new LinkedHashMap<>();
                    payload.put("actionType", "CANCEL_PURCHASE_INVOICE");
                    payload.put("invoiceCode", invOpt.get().getCode());
                    payload.put("invoiceId", invOpt.get().getId());

                    if (!env.auto()) {
                        return AiAssistantResponse.builder()
                                .reply("Bạn có chắc chắn muốn hủy đơn hàng **" + invOpt.get().getCode() + "** không?")
                                .actionType("CANCEL_PURCHASE_INVOICE")
                                .executed(false)
                                .requiresConfirmation(true)
                                .pendingAction(Map.of(
                                        "actionType", "CANCEL_PURCHASE_INVOICE",
                                        "title", "Hủy hóa đơn: " + invOpt.get().getCode(),
                                        "payload", payload
                                ))
                                .build();
                    }

                    return executeMutationPayload(payload, env.user());
                }
            }
        }

        // 6. TRANSFER_FLOCK (Tách / Chuyển đàn giữa các chuồng)
        if (norm.contains("chuyen dan") || norm.contains("tach dan") || (norm.contains("chuyen") && (norm.contains("con ga") || norm.contains("con") || norm.contains("dan")) && norm.contains("sang"))) {
            if (env.worker()) {
                return workerBlocked("TRANSFER_FLOCK");
            }
            Matcher matcher = Pattern.compile("(?:tu\\s+)?([a-z0-9\\s]+?)\\s+sang\\s+([a-z0-9\\s]+)").matcher(norm);
            Barn sourceBarn = null;
            Barn targetBarn = null;
            if (matcher.find()) {
                sourceBarn = resolveBarn(matcher.group(1), matcher.group(1));
                targetBarn = resolveBarn(matcher.group(2), matcher.group(2));
            }
            if (sourceBarn == null) {
                sourceBarn = resolveBarn(norm, message, currentRoute);
            }
            if (targetBarn == null && sourceBarn != null) {
                for (Barn b : barnRepository.findAll()) {
                    if (!b.getId().equals(sourceBarn.getId()) && norm.contains(normalizeText(b.getName()))) {
                        targetBarn = b;
                        break;
                    }
                }
            }
            if (sourceBarn != null && targetBarn != null) {
                Optional<FarmingCycle> sCycle = cycleRepository.findFirstByBarnIdAndStatus(sourceBarn.getId(), CycleStatus.ACTIVE);
                if (sCycle.isPresent()) {
                    List<Flock> flocks = flockRepository.findAllByCycleIdOrderByImportDateAscIdAsc(sCycle.get().getId());
                    Flock flock = flocks.stream().filter(f -> f.getStatus() == FlockStatus.ACTIVE).findFirst().orElse(null);
                    if (flock != null) {
                        Matcher qMatcher = Pattern.compile("(\\d+)\\s*(?:con)?").matcher(norm);
                        int qty = qMatcher.find() ? Integer.parseInt(qMatcher.group(1)) : 100;

                        Map<String, Object> payload = new LinkedHashMap<>();
                        payload.put("actionType", "TRANSFER_FLOCK");
                        payload.put("flockId", flock.getId());
                        payload.put("sourceBarnId", sourceBarn.getId());
                        payload.put("targetBarnId", targetBarn.getId());
                        payload.put("quantity", qty);

                        if (!env.auto()) {
                            return AiAssistantResponse.builder()
                                    .reply("Bạn có muốn chuyển **" + qty + " con gà** từ **" + sourceBarn.getName() + "** sang **" + targetBarn.getName() + "** không?")
                                    .actionType("TRANSFER_FLOCK")
                                    .executed(false)
                                    .requiresConfirmation(true)
                                    .pendingAction(Map.of(
                                            "actionType", "TRANSFER_FLOCK",
                                            "title", "Chuyển đàn: " + sourceBarn.getName() + " ➔ " + targetBarn.getName(),
                                            "payload", payload
                                    ))
                                    .build();
                        }

                        return executeMutationPayload(payload, env.user());
                    }
                }
            }
        }

        // 7. START_OR_CLOSE_CYCLE (Bắt đầu hoặc kết thúc lứa)
        if (norm.contains("mo lua") || norm.contains("bat dau lua") || norm.contains("khai bao lua") || norm.contains("ket thuc lua") || norm.contains("dong lua")) {
            if (env.worker()) {
                return workerBlocked("START_OR_CLOSE_CYCLE");
            }
            Barn barn = resolveBarn(norm, message, currentRoute);
            if (barn != null) {
                boolean isClose = norm.contains("ket thuc") || norm.contains("dong");
                if (isClose) {
                    Optional<FarmingCycle> actCycle = cycleRepository.findFirstByBarnIdAndStatus(barn.getId(), CycleStatus.ACTIVE);
                    if (actCycle.isPresent()) {
                        Map<String, Object> payload = Map.of("actionType", "CLOSE_CYCLE", "cycleId", actCycle.get().getId(), "barnName", barn.getName());
                        if (!env.auto()) {
                            return AiAssistantResponse.builder()
                                    .reply("Bạn có muốn kết thúc lứa nuôi tại **" + barn.getName() + "** không?")
                                    .actionType("START_OR_CLOSE_CYCLE")
                                    .executed(false)
                                    .requiresConfirmation(true)
                                    .pendingAction(Map.of("actionType", "CLOSE_CYCLE", "title", "Kết thúc lứa: " + barn.getName(), "payload", payload))
                                    .build();
                        }
                        return executeMutationPayload(payload, env.user());
                    }
                } else {
                    Map<String, Object> payload = Map.of("actionType", "START_CYCLE", "barnId", barn.getId(), "barnName", barn.getName());
                    if (!env.auto()) {
                        return AiAssistantResponse.builder()
                                .reply("Bạn có muốn mở lứa nuôi mới tại **" + barn.getName() + "** không?")
                                .actionType("START_OR_CLOSE_CYCLE")
                                .executed(false)
                                .requiresConfirmation(true)
                                .pendingAction(Map.of("actionType", "START_CYCLE", "title", "Mở lứa: " + barn.getName(), "payload", payload))
                                .build();
                    }
                    return executeMutationPayload(payload, env.user());
                }
            }
        }

        // 8. LOG_OR_UPDATE_FEED (Sửa lượng cám đã ghi hoặc bù trừ sai sót)
        boolean hasUpdateSignal = norm.contains("sua") || norm.contains("doi") || norm.contains("nham") || norm.contains("thanh") || norm.contains("lai");
        if (hasUpdateSignal && (norm.contains("cam") || norm.contains("cho an") || "LOG_FEED".equals(ctx.get("lastIntent")) || "LOG_OR_UPDATE_FEED".equals(ctx.get("lastIntent")))) {
            Barn barn = resolveBarn(norm, message, currentRoute);
            if (barn == null && ctx.get("barnId") != null) {
                barn = barnRepository.findById(Long.valueOf(String.valueOf(ctx.get("barnId")))).orElse(null);
            }
            if (barn != null) {
                Optional<FarmingCycle> cycleOpt = cycleRepository.findFirstByBarnIdAndStatus(barn.getId(), CycleStatus.ACTIVE);
                if (cycleOpt.isPresent()) {
                    List<FeedRecord> records = feedRepository.findAllByCycleIdOrderByRecordDateDescIdDesc(cycleOpt.get().getId());
                    FeedRecord latestRecord = records.stream().findFirst().orElse(null);
                    if (latestRecord != null) {
                        Matcher kgMatcher = Pattern.compile("(\\d+(?:[.,]\\d+)?)\\s*(?:kg|ki|ky|can)").matcher(norm);
                        double newKg = 0;
                        if (kgMatcher.find()) {
                            newKg = Double.parseDouble(kgMatcher.group(1).replace(',', '.'));
                        } else {
                            Matcher baoMatcher = Pattern.compile("(\\d+(?:[.,]\\d+)?)\\s*bao").matcher(norm);
                            if (baoMatcher.find()) {
                                newKg = Double.parseDouble(baoMatcher.group(1).replace(',', '.')) * 25.0;
                            } else {
                                Matcher genericNum = Pattern.compile("(?:thanh|la|thanh ra)\\s*(\\d+(?:[.,]\\d+)?)").matcher(norm);
                                if (genericNum.find()) {
                                    newKg = Double.parseDouble(genericNum.group(1).replace(',', '.'));
                                }
                            }
                        }
                        if (newKg > 0) {
                            Map<String, Object> payload = new LinkedHashMap<>();
                            payload.put("actionType", "UPDATE_FEED");
                            payload.put("recordId", latestRecord.getId());
                            payload.put("barnId", barn.getId());
                            payload.put("newKg", newKg);

                            if (!env.auto()) {
                                return AiAssistantResponse.builder()
                                        .reply("Bạn có muốn sửa lại lượng cám của **" + barn.getName() + "** thành **" + newKg + " kg** không?")
                                        .actionType("LOG_OR_UPDATE_FEED")
                                        .executed(false)
                                        .requiresConfirmation(true)
                                        .pendingAction(Map.of(
                                                "actionType", "UPDATE_FEED",
                                                "title", "Sửa lượng cám: " + barn.getName(),
                                                "payload", payload
                                        ))
                                        .build();
                            }

                            return executeMutationPayload(payload, env.user());
                        }
                    }
                }
            }
        }

        // 9. LOG_OR_UPDATE_WEIGHT (Sửa cân mẫu)
        if (hasUpdateSignal && (norm.contains("can") || norm.contains("trong luong") || norm.contains("can mau") || "LOG_WEIGHT".equals(ctx.get("lastIntent")) || "LOG_OR_UPDATE_WEIGHT".equals(ctx.get("lastIntent")))) {
            Barn barn = resolveBarn(norm, message, currentRoute);
            if (barn == null && ctx.get("barnId") != null) {
                barn = barnRepository.findById(Long.valueOf(String.valueOf(ctx.get("barnId")))).orElse(null);
            }
            if (barn != null) {
                Optional<FarmingCycle> cycleOpt = cycleRepository.findFirstByBarnIdAndStatus(barn.getId(), CycleStatus.ACTIVE);
                if (cycleOpt.isPresent()) {
                    List<WeightSample> samples = weightRepository.findAllByCycleIdOrderBySampleDateDescIdDesc(cycleOpt.get().getId());
                    WeightSample latestSample = samples.stream().findFirst().orElse(null);
                    if (latestSample != null) {
                        Matcher weightMatcher = Pattern.compile("(\\d+(?:[.,]\\d+)?)\\s*(?:kg|can|ky)").matcher(norm);
                        double newAvg = 0;
                        if (weightMatcher.find()) {
                            newAvg = Double.parseDouble(weightMatcher.group(1).replace(',', '.'));
                        } else {
                            Matcher genericNum = Pattern.compile("(?:thanh|la)\\s*(\\d+(?:[.,]\\d+)?)").matcher(norm);
                            if (genericNum.find()) {
                                newAvg = Double.parseDouble(genericNum.group(1).replace(',', '.'));
                            }
                        }
                        if (newAvg > 0) {
                            Map<String, Object> payload = new LinkedHashMap<>();
                            payload.put("actionType", "UPDATE_WEIGHT");
                            payload.put("sampleId", latestSample.getId());
                            payload.put("barnId", barn.getId());
                            payload.put("avgWeight", newAvg);

                            Matcher sizeMatcher = Pattern.compile("(?:mau|co mau)\\s*(\\d+)\\s*(?:con)?").matcher(norm);
                            if (sizeMatcher.find()) {
                                payload.put("sampleSize", Integer.parseInt(sizeMatcher.group(1)));
                            }

                            if (!env.auto()) {
                                return AiAssistantResponse.builder()
                                        .reply("Bạn có muốn sửa lại kết quả cân mẫu **" + barn.getName() + "** thành **" + newAvg + " kg** không?")
                                        .actionType("LOG_OR_UPDATE_WEIGHT")
                                        .executed(false)
                                        .requiresConfirmation(true)
                                        .pendingAction(Map.of(
                                                "actionType", "UPDATE_WEIGHT",
                                                "title", "Sửa cân mẫu: " + barn.getName(),
                                                "payload", payload
                                        ))
                                        .build();
                            }

                            return executeMutationPayload(payload, env.user());
                        }
                    }
                }
            }
        }

        // 10. LOG_OR_UPDATE_MORTALITY (Sửa hao hụt / chết / loại thải / xuất bán)
        boolean isMovementUpdate = hasUpdateSignal && (norm.contains("hao hut") || norm.contains("chet") || norm.contains("loai thai") || norm.contains("xuat ban") || norm.contains("thu hoach")
                || "LOG_MORTALITY".equals(ctx.get("lastIntent")) || "LOG_OR_UPDATE_MORTALITY".equals(ctx.get("lastIntent")));
        if (isMovementUpdate) {
            Barn barn = resolveBarn(norm, message, currentRoute);
            if (barn == null && ctx.get("barnId") != null) {
                barn = barnRepository.findById(Long.valueOf(String.valueOf(ctx.get("barnId")))).orElse(null);
            }
            if (barn != null) {
                Matcher numMatcher = Pattern.compile("(?:la|thanh)?\\s*(\\d+)\\s*(?:con)?").matcher(norm);
                int qty = 0;
                while (numMatcher.find()) {
                    qty = Integer.parseInt(numMatcher.group(1));
                }
                if (qty > 0) {
                    Map<String, Object> payload = new LinkedHashMap<>();
                    payload.put("actionType", "UPDATE_MORTALITY");
                    payload.put("barnId", barn.getId());
                    payload.put("quantity", qty);
                    if (norm.contains("xuat ban") || norm.contains("thu hoach")) {
                        payload.put("movementType", "HARVEST");
                    } else if (norm.contains("loai thai")) {
                        payload.put("movementType", "CULL");
                    } else if (norm.contains("chet") || norm.contains("hao hut")) {
                        payload.put("movementType", "DEATH");
                    }
                    if (!env.auto()) {
                        String moveLabel = "HARVEST".equals(payload.get("movementType")) ? "xuất bán" : ("CULL".equals(payload.get("movementType")) ? "loại thải" : "hao hụt");
                        return AiAssistantResponse.builder()
                                .reply("Bạn có muốn sửa lại số lượng " + moveLabel + " tại **" + barn.getName() + "** thành **" + qty + " con** không?")
                                .actionType("LOG_OR_UPDATE_MORTALITY")
                                .executed(false)
                                .requiresConfirmation(true)
                                .pendingAction(Map.of("actionType", "UPDATE_MORTALITY", "title", "Sửa " + moveLabel + ": " + barn.getName(), "payload", payload))
                                .build();
                    }
                    return executeMutationPayload(payload, env.user());
                }
            }
        }

        // 11. LOG_OR_UPDATE_EXPENSE (Sửa chi phí)
        if (hasUpdateSignal && (norm.contains("chi phi") || norm.contains("tien dien") || norm.contains("tien nuoc") || norm.contains("tien thuoc") || "LOG_EXPENSE".equals(ctx.get("lastIntent")) || "LOG_OR_UPDATE_EXPENSE".equals(ctx.get("lastIntent")))) {
            if (env.worker()) {
                return workerBlocked("LOG_EXPENSE");
            }
            Barn barn = resolveBarn(norm, message, currentRoute);
            if (barn == null && ctx.get("barnId") != null) {
                barn = barnRepository.findById(Long.valueOf(String.valueOf(ctx.get("barnId")))).orElse(null);
            }
            if (barn != null) {
                Matcher numMatcher = Pattern.compile("(\\d{4,12})").matcher(norm);
                long amount = 0;
                if (numMatcher.find()) {
                    amount = Long.parseLong(numMatcher.group(1));
                }
                if (amount > 0) {
                    Map<String, Object> payload = Map.of("actionType", "UPDATE_EXPENSE", "barnId", barn.getId(), "amount", amount);
                    if (!env.auto()) {
                        String formatted = NumberFormat.getInstance(new Locale("vi", "VN")).format(amount) + " đ";
                        return AiAssistantResponse.builder()
                                .reply("Bạn có muốn sửa lại chi phí cho **" + barn.getName() + "** thành **" + formatted + "** không?")
                                .actionType("LOG_OR_UPDATE_EXPENSE")
                                .executed(false)
                                .requiresConfirmation(true)
                                .pendingAction(Map.of("actionType", "UPDATE_EXPENSE", "title", "Sửa chi phí: " + barn.getName(), "payload", payload))
                                .build();
                    }
                    return executeMutationPayload(payload, env.user());
                }
            }
        }

        return null;
    }


    // ─────────────────────────────────────────────────────────────────────────────
    // LAYER 2: LOCAL VIETNAMESE RULE-BASED & REGEX ACTION ENGINE (100% Deterministic)
    // ─────────────────────────────────────────────────────────────────────────────

    private AiAssistantResponse evaluateRuleEngine(String message, String currentRoute, String username, boolean isWorker) {
        return evaluateRuleEngine(message, currentRoute, username, isWorker, true);
    }

    private AiAssistantResponse evaluateRuleEngine(String message, String currentRoute, String username, boolean isWorker, boolean autoExecute) {
        String norm = normalizeText(message);

        // 1. IMPORT_PURCHASE_STOCK (Xác nhận nhập kho đơn hàng NHxxxx)
        if (norm.contains("nhap kho") || norm.contains("nhan kho") || norm.contains("xac nhan nhap kho") || norm.contains("xac nhan nhan kho")) {
            Matcher codeMatcher = Pattern.compile("nh\\s*[-_]?\\s*(\\d+)", Pattern.CASE_INSENSITIVE).matcher(norm);
            String invoiceCode = null;
            if (codeMatcher.find()) {
                invoiceCode = String.format(Locale.ROOT, "NH%06d", Integer.parseInt(codeMatcher.group(1)));
            } else {
                Matcher numMatcher = Pattern.compile("(?:don hang|don|so)\\s*(\\d{1,6})").matcher(norm);
                if (numMatcher.find()) {
                    invoiceCode = String.format(Locale.ROOT, "NH%06d", Integer.parseInt(numMatcher.group(1)));
                }
            }

            if (invoiceCode != null) {
                return handleImportStock(invoiceCode, autoExecute);
            }
        }

        // 2. QUERY_FARM_STATUS (Tra cứu tồn kho, tình trạng chuồng, công nợ)
        if (norm.contains("ton kho") || norm.contains("tinh trang") || norm.contains("cong no") || norm.contains("con bao nhieu") || norm.contains("nhiet do")) {
            AiAssistantResponse queryResponse = handleFarmStatusQuery(norm, message, currentRoute, isWorker);
            if (queryResponse != null) {
                return queryResponse;
            }
        }

        // 3. VET_DIAGNOSIS (Bệnh thú y, chẩn đoán triệu chứng hô hấp/tiêu hóa cụ thể)
        if (norm.contains("kho khe") || norm.contains("kho tho") || norm.matches(".*\\btho\\s+(?:kho|gap|nhanh|hoi|hon hen).*") || norm.contains("ngap") || norm.contains("phan sap") || norm.contains("phan trang") || norm.contains("cau trung") || norm.matches(".*\\bhen\\b.*") || norm.contains("crd")) {
            return handleVetDiagnosis(norm, message);
        }

        // 4. NAVIGATE_AND_PREFILL (Điều hướng trang hoặc Mở Modal tạo đơn / form nhanh)
        if (norm.startsWith("mo ") || norm.startsWith("chuyen sang ") || norm.startsWith("chuyen den ") || norm.startsWith("di toi ") || norm.startsWith("xem ") || norm.startsWith("vao ") || norm.startsWith("tao don") || norm.contains("tao don nhap") || norm.contains("quet hoa don") || norm.contains("boc tach hoa don") || norm.contains("tao phieu xuat") || norm.contains("man hinh ") || norm.matches(".*\\btrang\\s+(?:hoa don|nhap hang|khu nuoi|chuong|kho|nhat ky|tai khoan|bao cao|so quy|ban hang|nha cung cap)\\b.*")) {
            AiAssistantResponse navResponse = handleNavigationAndPrefill(norm, message);
            if (navResponse != null) {
                return navResponse;
            }
        }

        // 5. CREATE_BARN (Tạo chuồng nuôi mới)
        if (norm.contains("tao chuong") || norm.contains("them chuong") || norm.contains("tao moi chuong") || norm.contains("them moi chuong")) {
            if (isWorker) {
                return AiAssistantResponse.builder()
                        .reply("⚠️ Tài khoản Công nhân không có quyền tạo hoặc chỉnh sửa cơ sở chuồng nuôi.")
                        .actionType("CREATE_BARN")
                        .executed(false)
                        .build();
            }
            AiAssistantResponse barnRes = handleCreateBarn(norm, message, autoExecute);
            if (barnRes != null) return barnRes;
        }

        // 6. CREATE_SUPPLIER (Thêm nhà cung cấp mới)
        if (norm.contains("tao nha cung cap") || norm.contains("them nha cung cap") || norm.contains("them ncc") || norm.contains("tao ncc") || norm.contains("them doi tac")) {
            if (isWorker) {
                return AiAssistantResponse.builder()
                        .reply("⚠️ Tài khoản Công nhân không có quyền quản lý danh mục nhà cung cấp.")
                        .actionType("CREATE_SUPPLIER")
                        .executed(false)
                        .build();
            }
            AiAssistantResponse suppRes = handleCreateSupplier(norm, message, autoExecute);
            if (suppRes != null) return suppRes;
        }

        // 7. CREATE_AREA (Thêm khu vực nuôi mới)
        if (norm.contains("tao khu") || norm.contains("them khu") || norm.contains("tao khu vuc") || norm.contains("them khu vuc")) {
            if (isWorker) {
                return AiAssistantResponse.builder()
                        .reply("⚠️ Tài khoản Công nhân không có quyền quản lý khu vực trang trại.")
                        .actionType("CREATE_AREA")
                        .executed(false)
                        .build();
            }
            AiAssistantResponse areaRes = handleCreateArea(norm, message, autoExecute);
            if (areaRes != null) return areaRes;
        }

        // 8. LOG_EXPENSE (Ghi chi phí tiền điện, nước, thuốc...)
        if (norm.contains("chi phi") || norm.contains("tien dien") || norm.contains("tien nuoc") || norm.contains("tien thuoc") || norm.contains("tien cong") || norm.contains("nhan cong")) {
            if (isWorker) {
                return AiAssistantResponse.builder()
                        .reply("⚠️ Tài khoản Công nhân không có quyền thực hiện thao tác tài chính này. Vui lòng liên hệ Kế toán hoặc Chủ trại.")
                        .actionType("LOG_EXPENSE")
                        .executed(false)
                        .build();
            }
            AiAssistantResponse expenseResponse = handleLogExpense(norm, message, currentRoute, username, autoExecute);
            if (expenseResponse != null) {
                return expenseResponse;
            }
        }

        // 9. LOG_FEED (Ghi cám cho chuồng)
        if (norm.contains("cam") || norm.contains("cho an") || norm.contains("do cam")) {
            if (!norm.contains("ton kho") && !norm.contains("con bao nhieu") && !norm.contains("kiem tra") && (norm.contains("kg") || norm.contains("ki") || norm.contains("ky") || norm.contains("can") || norm.contains("bao") || norm.contains("cho") || norm.contains("an"))) {
                AiAssistantResponse feedResponse = handleLogFeed(norm, message, currentRoute, username, autoExecute);
                if (feedResponse != null) {
                    return feedResponse;
                }
            }
        }

        // 10. LOG_WEIGHT (Cân mẫu chuồng...)
        if (norm.contains("can mau") || norm.contains("can nang") || norm.contains("trong luong") || norm.contains("khoi luong")) {
            AiAssistantResponse weightResponse = handleLogWeight(norm, message, currentRoute, username, autoExecute);
            if (weightResponse != null) {
                return weightResponse;
            }
        }

        // 11. LOG_MORTALITY (Hao hụt, chết, loại thải, xuất bán)
        if (norm.contains("hao hut") || norm.contains("chet") || norm.contains("loai thai") || norm.contains("xuat ban") || norm.contains("thu hoach")) {
            AiAssistantResponse mortalityResponse = handleLogMortality(norm, message, currentRoute, username, autoExecute);
            if (mortalityResponse != null) {
                return mortalityResponse;
            }
        }

        // 12. COMPLETE_DAILY_TASKS (Xác nhận hoàn thành việc hôm nay / công việc theo chương trình)
        if (norm.contains("viec hom nay") || norm.contains("cong viec hom nay") ||
                norm.contains("lam xong viec") || norm.contains("hoan thanh viec") ||
                norm.contains("xong viec") || norm.contains("tich xong") || norm.contains("tich viec") ||
                norm.contains("xong het viec") || norm.contains("hoan thanh cong viec") ||
                norm.matches(".*\\b(?:da\\s+)?(?:lam\\s+)?xong\\s+(?:het\\s+)?(?:cac\\s+)?viec.*") ||
                norm.matches(".*\\bviec\\s+(?:hom\\s+nay\\s+)?(?:da\\s+)?(?:lam\\s+)?xong.*")) {
            AiAssistantResponse tasksResponse = handleCompleteDailyTasks(norm, message, currentRoute, username, autoExecute);
            if (tasksResponse != null) {
                return tasksResponse;
            }
        }

        return null;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // ACTION IMPLEMENTATIONS
    // ─────────────────────────────────────────────────────────────────────────────

    private AiAssistantResponse handleCompleteDailyTasks(String norm, String originalMsg, String currentRoute, String username) {
        return handleCompleteDailyTasks(norm, originalMsg, currentRoute, username, true);
    }

    private AiAssistantResponse handleCompleteDailyTasks(String norm, String originalMsg, String currentRoute, String username, boolean autoExecute) {
        LocalDate today = LocalDate.now();

        // Check if user targeted a specific barn or cycle
        Long targetCycleId = null;
        Barn targetBarn = resolveBarn(norm, originalMsg, currentRoute);

        if (targetBarn != null) {
            Optional<FarmingCycle> cycleOpt = cycleRepository.findFirstByBarnIdAndStatus(targetBarn.getId(), CycleStatus.ACTIVE);
            if (cycleOpt.isPresent()) {
                targetCycleId = cycleOpt.get().getId();
            } else {
                return cycleNotFoundResponse(targetBarn);
            }
        } else if (currentRoute != null) {
            Matcher cycleMatcher = Pattern.compile("[?&]cycle=(\\d+)").matcher(currentRoute);
            if (cycleMatcher.find()) {
                targetCycleId = Long.parseLong(cycleMatcher.group(1));
            }
        }

        List<BarnDayPlan> plans;
        try {
            plans = dailyPlanService.farm(today, false);
        } catch (Exception ex) {
            log.warn("Error fetching daily plan: {}", ex.getMessage());
            return AiAssistantResponse.builder()
                    .reply("⚠️ Không thể tải danh sách phiếu việc hôm nay: " + ex.getMessage())
                    .actionType("COMPLETE_DAILY_TASKS")
                    .executed(false)
                    .build();
        }

        if (plans == null || plans.isEmpty()) {
            return AiAssistantResponse.builder()
                    .reply("ℹ️ Hôm nay không có chuồng nào đang nuôi theo chương trình cần thực hiện việc.")
                    .actionType("COMPLETE_DAILY_TASKS")
                    .executed(false)
                    .navigateTo("/today-tasks")
                    .build();
        }

        // Filter plans by targetCycleId if specified
        List<BarnDayPlan> targetPlans = plans;
        if (targetCycleId != null) {
            final Long cid = targetCycleId;
            targetPlans = plans.stream().filter(p -> p.cycleId().equals(cid)).toList();
            if (targetPlans.isEmpty()) {
                String bName = targetBarn != null ? targetBarn.getName() : ("Lứa #" + cid);
                return AiAssistantResponse.builder()
                        .reply("ℹ️ Chuồng **" + bName + "** hôm nay không có công việc nào cần thực hiện.")
                        .actionType("COMPLETE_DAILY_TASKS")
                        .executed(false)
                        .navigateTo("/today-tasks")
                        .build();
            }
        }

        long pendingTasksCount = targetPlans.stream()
                .flatMap(p -> p.tasks().stream())
                .filter(t -> t.done() == null)
                .count();

        if (pendingTasksCount == 0) {
            String scope = targetBarn != null ? ("của chuồng **" + targetBarn.getName() + "**") : "trên toàn bộ các chuồng";
            return AiAssistantResponse.builder()
                    .reply("ℹ️ Tất cả công việc hôm nay " + scope + " đã được xác nhận hoàn thành trước đó.")
                    .actionType("COMPLETE_DAILY_TASKS")
                    .executed(true)
                    .navigateTo("/today-tasks")
                    .uiCommand("REFRESH_DATA")
                    .build();
        }

        if (!autoExecute) {
            String scopeName = targetBarn != null ? targetBarn.getName() : ("Toàn bộ các chuồng (" + targetPlans.size() + " chuồng)");
            Map<String, Object> details = new LinkedHashMap<>();
            details.put("Phạm vi", scopeName);
            details.put("Số lượng việc chờ", pendingTasksCount + " công việc");
            details.put("Tác động", "Tự động trừ kho cám/thuốc và tính chi phí lứa nuôi");

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("actionType", "COMPLETE_DAILY_TASKS");
            if (targetCycleId != null) payload.put("targetCycleId", targetCycleId);
            if (targetBarn != null) payload.put("barnName", targetBarn.getName());

            return AiAssistantResponse.builder()
                    .reply("Tôi đã kiểm tra danh sách phiếu việc hôm nay. Bạn có chắc chắn muốn xác nhận hoàn thành **" + pendingTasksCount + " công việc** cho **" + scopeName + "** không?")
                    .actionType("COMPLETE_DAILY_TASKS")
                    .executed(false)
                    .requiresConfirmation(true)
                    .pendingAction(Map.of(
                            "actionType", "COMPLETE_DAILY_TASKS",
                            "title", "Xác nhận hoàn thành việc hôm nay",
                            "description", "Hoàn thành " + pendingTasksCount + " việc hôm nay (" + scopeName + ")",
                            "details", details,
                            "payload", payload
                    ))
                    .build();
        }

        return commitCompleteDailyTasksExecution(targetPlans, targetBarn, username);
    }

    private AiAssistantResponse commitCompleteDailyTasksExecution(List<BarnDayPlan> targetPlans, Barn targetBarn, String username) {
        LocalDate today = LocalDate.now();
        int confirmedCount = 0;
        int alreadyDoneCount = 0;
        List<String> confirmedDetails = new ArrayList<>();
        List<String> failedDetails = new ArrayList<>();

        for (BarnDayPlan plan : targetPlans) {
            int barnConfirmed = 0;
            for (BarnDayPlan.Task task : plan.tasks()) {
                if (task.done() != null) {
                    alreadyDoneCount++;
                    continue;
                }

                try {
                    DailyTaskConfirmRequest confirmReq = new DailyTaskConfirmRequest(
                            today,
                            task.key(),
                            null, // null = làm đúng định mức kế hoạch
                            "Xác nhận tự động qua Trợ lý FarmShift AI"
                    );
                    dailyPlanService.confirm(plan.cycleId(), confirmReq, username != null && !username.isBlank() ? username : "Trợ lý AI", false);
                    confirmedCount++;
                    barnConfirmed++;
                } catch (Exception ex) {
                    log.warn("Error confirming task {} for cycle {}: {}", task.name(), plan.cycleId(), ex.getMessage());
                    failedDetails.add(plan.barnName() + " (" + task.name() + ": " + ex.getMessage() + ")");
                }
            }
            if (barnConfirmed > 0) {
                confirmedDetails.add(plan.barnName() + " (" + barnConfirmed + " việc)");
            }
        }

        if (confirmedCount == 0 && alreadyDoneCount > 0) {
            String scope = targetBarn != null ? ("của chuồng **" + targetBarn.getName() + "**") : "trên toàn bộ các chuồng";
            return AiAssistantResponse.builder()
                    .reply("ℹ️ Tất cả công việc hôm nay " + scope + " đã được xác nhận hoàn thành trước đó (" + alreadyDoneCount + " việc đã xong).")
                    .actionType("COMPLETE_DAILY_TASKS")
                    .executed(true)
                    .navigateTo("/today-tasks")
                    .uiCommand("REFRESH_DATA")
                    .actionSummary(Map.of(
                            "title", "Công việc hôm nay đã hoàn tất",
                            "detail", "Tất cả " + alreadyDoneCount + " việc đã hoàn thành",
                            "completedCount", String.valueOf(alreadyDoneCount),
                            "timestamp", LocalDateTime.now().toString()
                    ))
                    .build();
        }

        if (confirmedCount == 0 && !failedDetails.isEmpty()) {
            return AiAssistantResponse.builder()
                    .reply("⚠️ Không thể hoàn thành công việc do tồn kho không đủ hoặc lỗi định mức:\n- " + String.join("\n- ", failedDetails))
                    .actionType("COMPLETE_DAILY_TASKS")
                    .executed(false)
                    .navigateTo("/today-tasks")
                    .build();
        }

        String barnDetail = confirmedDetails.isEmpty() ? "Không có việc mới" : String.join(", ", confirmedDetails);
        StringBuilder replyBuilder = new StringBuilder();
        replyBuilder.append("✅ Đã xác nhận hoàn thành thành công **").append(confirmedCount).append(" công việc** hôm nay");
        if (targetBarn != null) {
            replyBuilder.append(" cho chuồng **").append(targetBarn.getName()).append("**");
        } else {
            replyBuilder.append(" cho: **").append(barnDetail).append("**");
        }
        replyBuilder.append(" (bao gồm định mức cữ cám, thuốc thú y, kiểm tra môi trường). Tồn kho và chi phí lứa nuôi đã được cập nhật tự động.");

        if (!failedDetails.isEmpty()) {
            replyBuilder.append("\n⚠️ Một số việc chưa thể xác nhận:\n- ").append(String.join("\n- ", failedDetails));
        }

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("title", "Đã hoàn thành việc hôm nay");
        summary.put("barnName", targetBarn != null ? targetBarn.getName() : "Toàn trại (" + targetPlans.size() + " chuồng)");
        summary.put("detail", "Hoàn thành " + confirmedCount + " việc • " + barnDetail);
        summary.put("completedCount", String.valueOf(confirmedCount));
        summary.put("timestamp", LocalDateTime.now().toString());

        return AiAssistantResponse.builder()
                .reply(replyBuilder.toString())
                .actionType("COMPLETE_DAILY_TASKS")
                .executed(true)
                .navigateTo("/today-tasks")
                .uiCommand("REFRESH_DATA")
                .actionSummary(summary)
                .build();
    }

    private AiAssistantResponse handleImportStock(String invoiceCode) {
        return handleImportStock(invoiceCode, true);
    }

    private AiAssistantResponse handleImportStock(String invoiceCode, boolean autoExecute) {
        Optional<PurchaseInvoice> opt = invoiceRepository.findByCode(invoiceCode);
        if (opt.isEmpty()) {
            return AiAssistantResponse.builder()
                    .reply("⚠️ Không tìm thấy hóa đơn nhập hàng với mã **" + invoiceCode + "**. Vui lòng kiểm tra lại danh sách hóa đơn.")
                    .actionType("IMPORT_PURCHASE_STOCK")
                    .executed(false)
                    .build();
        }

        PurchaseInvoice invoice = opt.get();
        if ("Đã nhập kho".equalsIgnoreCase(invoice.getStockStatus())) {
            return AiAssistantResponse.builder()
                    .reply("ℹ️ Hóa đơn **" + invoiceCode + "** đã được nhập kho trước đó vào ngày " + (invoice.getImportedDate() != null ? invoice.getImportedDate() : "") + ".")
                    .actionType("IMPORT_PURCHASE_STOCK")
                    .executed(true)
                    .uiCommand("REFRESH_DATA")
                    .actionSummary(Map.of(
                            "title", "Hóa đơn đã nhập kho",
                            "detail", "Mã đơn " + invoiceCode + " • Tồn kho đã ghi nhận",
                            "timestamp", LocalDateTime.now().toString()
                    ))
                    .build();
        }

        String supplierName = invoice.getSupplier() != null ? invoice.getSupplier().getName() : "Nhà cung cấp";

        if (!autoExecute) {
            Map<String, Object> details = new LinkedHashMap<>();
            details.put("Mã hóa đơn", invoiceCode);
            details.put("Nhà cung cấp", supplierName);
            details.put("Tổng tiền", NumberFormat.getInstance(new Locale("vi", "VN")).format(invoice.getTotalAmount() != null ? invoice.getTotalAmount() : 0) + " đ");
            details.put("Hành động", "Xác nhận nhập kho & cộng số lượng vào tồn kho");

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("actionType", "IMPORT_PURCHASE_STOCK");
            payload.put("invoiceCode", invoiceCode);
            payload.put("invoiceId", invoice.getId());

            return AiAssistantResponse.builder()
                    .reply("Bạn có muốn xác nhận nhập kho đơn hàng **" + invoiceCode + "** từ **" + supplierName + "** không?")
                    .actionType("IMPORT_PURCHASE_STOCK")
                    .executed(false)
                    .requiresConfirmation(true)
                    .pendingAction(Map.of(
                            "actionType", "IMPORT_PURCHASE_STOCK",
                            "title", "Xác nhận nhập kho đơn hàng " + invoiceCode,
                            "description", "Nhập kho đơn hàng " + invoiceCode + " từ " + supplierName,
                            "details", details,
                            "payload", payload
                    ))
                    .build();
        }

        purchaseService.importStock(invoice.getId());

        return AiAssistantResponse.builder()
                .reply("✅ Đã xác nhận nhập kho thành công đơn hàng **" + invoiceCode + "** từ **" + supplierName + "**. Số lượng tồn kho các mặt hàng đã được cộng tự động vào kho.")
                .actionType("IMPORT_PURCHASE_STOCK")
                .executed(true)
                .uiCommand("REFRESH_DATA")
                .actionSummary(Map.of(
                        "title", "Đã nhập kho đơn hàng",
                        "detail", "Đơn " + invoiceCode + " • " + supplierName,
                        "timestamp", LocalDateTime.now().toString()
                ))
                .build();
    }

    private AiAssistantResponse handleLogFeed(String norm, String originalMsg, String username) {
        return handleLogFeed(norm, originalMsg, null, username, true);
    }

    private AiAssistantResponse handleLogFeed(String norm, String originalMsg, String currentRoute, String username) {
        return handleLogFeed(norm, originalMsg, currentRoute, username, true);
    }

    private AiAssistantResponse handleLogFeed(String norm, String originalMsg, String currentRoute, String username, boolean autoExecute) {
        Barn barn = resolveBarn(norm, originalMsg, currentRoute);
        if (barn == null) {
            if (hasBarnMention(norm, currentRoute)) {
                return barnNotFoundResponse(norm);
            }
            return null;
        }

        Optional<FarmingCycle> cycleOpt = cycleRepository.findFirstByBarnIdAndStatus(barn.getId(), CycleStatus.ACTIVE);
        if (cycleOpt.isEmpty()) {
            return cycleNotFoundResponse(barn);
        }

        FarmingCycle cycle = cycleOpt.get();

        // Parse quantity & unit (e.g. 50 kg, 2 bao, 25.5 kg)
        double qty = 25.0;
        boolean isBao = false;

        Matcher baoMatcher = Pattern.compile("(\\d+(?:[.,]\\d+)?)\\s*bao").matcher(norm);
        Matcher kgMatcher = Pattern.compile("(\\d+(?:[.,]\\d+)?)\\s*(?:kg|ki|ky|can|kilogram)").matcher(norm);

        if (baoMatcher.find()) {
            qty = Double.parseDouble(baoMatcher.group(1).replace(',', '.'));
            isBao = true;
        } else if (kgMatcher.find()) {
            qty = Double.parseDouble(kgMatcher.group(1).replace(',', '.'));
            isBao = false;
        } else {
            Matcher generalMatcher = Pattern.compile("(?:cho an|do cam|ghi cam).*?(\\d+(?:[.,]\\d+)?)").matcher(norm);
            if (generalMatcher.find()) {
                qty = Double.parseDouble(generalMatcher.group(1).replace(',', '.'));
            }
        }

        double totalKg = isBao ? qty * 25.0 : qty;

        // Parse feed name
        String feedName = "Cám Higro 01";
        if (norm.contains("higro 02")) feedName = "Cám Higro 02";
        else if (norm.contains("higro 01") || norm.contains("higro")) feedName = "Cám Higro 01";
        else if (norm.contains("cp 512") || norm.contains("512")) feedName = "Cám CP 512";
        else if (norm.contains("cp 511") || norm.contains("511")) feedName = "Cám CP 511";
        else if (norm.contains("dabaco")) feedName = "Cám Dabaco";
        else if (norm.contains("giai doan 2")) feedName = "Cám giai đoạn 2";
        else if (norm.contains("giai doan 1")) feedName = "Cám giai đoạn 1";

        String unitDetail = isBao ? ((qty == Math.floor(qty) ? String.valueOf((long) qty) : String.valueOf(qty)) + " bao (" + totalKg + " kg)") : (totalKg + " kg");

        if (!autoExecute) {
            Map<String, Object> details = new LinkedHashMap<>();
            details.put("Chuồng nuôi", barn.getName());
            details.put("Thức ăn", feedName);
            details.put("Số lượng", unitDetail);
            details.put("Khấu trừ kho", "Tự động trừ tồn kho cám nếu có");

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("actionType", "LOG_FEED");
            payload.put("barnId", barn.getId());
            payload.put("cycleId", cycle.getId());
            payload.put("barnName", barn.getName());
            payload.put("feedName", feedName);
            payload.put("totalKg", totalKg);
            payload.put("unitDetail", unitDetail);

            return AiAssistantResponse.builder()
                    .reply("Bạn có muốn ghi nhận cho **" + barn.getName() + "** ăn **" + unitDetail + "** thức ăn **" + feedName + "** không?")
                    .actionType("LOG_FEED")
                    .executed(false)
                    .requiresConfirmation(true)
                    .pendingAction(Map.of(
                            "actionType", "LOG_FEED",
                            "title", "Ghi nhận cám: " + barn.getName(),
                            "description", "Ghi nhận " + unitDetail + " cám " + feedName + " cho " + barn.getName(),
                            "details", details,
                            "payload", payload
                    ))
                    .build();
        }

        return commitLogFeed(barn, cycle, feedName, totalKg, unitDetail, username);
    }

    private AiAssistantResponse commitLogFeed(Barn barn, FarmingCycle cycle, String feedName, double totalKg, String unitDetail, String username) {
        FeedRecord record = new FeedRecord();
        record.setCycle(cycle);
        record.setRecordDate(LocalDate.now());
        record.setFeedName(feedName);
        record.setQuantityKg(BigDecimal.valueOf(totalKg));
        record.setUnitPrice(BigDecimal.valueOf(13500.00));
        record.setNote("Ghi tự động qua Trợ lý Giọng nói FarmShift AI");
        record.setCreatedBy(username != null && !username.isBlank() ? username : "Trợ lý AI");
        feedRepository.save(record);

        // Deduct inventory if feed exists in warehouse
        try {
            deductInventoryStock(feedName, totalKg);
        } catch (Exception e) {
            log.warn("Could not deduct inventory stock for feed: {}", e.getMessage());
        }

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("title", "Đã ghi nhật ký cám");
        summary.put("barnName", barn.getName());
        summary.put("detail", feedName + " • " + unitDetail);
        summary.put("kg", String.valueOf(totalKg));
        summary.put("feedName", feedName);
        summary.put("timestamp", LocalDateTime.now().toString());

        return AiAssistantResponse.builder()
                .reply("✅ Đã ghi nhận cho **" + barn.getName() + "** ăn **" + unitDetail + "** cám **" + feedName + "** vào lứa nuôi hiện tại. Hệ số FCR và chi phí cám của chuồng đã được cập nhật.")
                .actionType("LOG_FEED")
                .executed(true)
                .uiCommand("REFRESH_DATA")
                .actionSummary(summary)
                .build();
    }

    private AiAssistantResponse handleLogWeight(String norm, String originalMsg, String username) {
        return handleLogWeight(norm, originalMsg, null, username, true);
    }

    private AiAssistantResponse handleLogWeight(String norm, String originalMsg, String currentRoute, String username) {
        return handleLogWeight(norm, originalMsg, currentRoute, username, true);
    }

    private AiAssistantResponse handleLogWeight(String norm, String originalMsg, String currentRoute, String username, boolean autoExecute) {
        Barn barn = resolveBarn(norm, originalMsg, currentRoute);
        if (barn == null) {
            if (hasBarnMention(norm, currentRoute)) {
                return barnNotFoundResponse(norm);
            }
            return null;
        }

        Optional<FarmingCycle> cycleOpt = cycleRepository.findFirstByBarnIdAndStatus(barn.getId(), CycleStatus.ACTIVE);
        if (cycleOpt.isEmpty()) {
            return cycleNotFoundResponse(barn);
        }

        FarmingCycle cycle = cycleOpt.get();

        // Extract avg weight (e.g. 1.45 kg, 1.5 kg)
        double avgWeight = 1.45;
        Matcher weightMatcher = Pattern.compile("(\\d+(?:[.,]\\d+)?)\\s*(?:kg|ki|ky|can|kilogram)").matcher(norm);
        if (weightMatcher.find()) {
            avgWeight = Double.parseDouble(weightMatcher.group(1).replace(',', '.'));
        }

        // Extract sample size (e.g. mau 50 con, 40 con)
        int sampleSize = 50;
        Matcher sizeMatcher = Pattern.compile("(?:mau|can)?\\s*(\\d+)\\s*con").matcher(norm);
        if (sizeMatcher.find()) {
            sampleSize = Integer.parseInt(sizeMatcher.group(1));
        }

        if (!autoExecute) {
            Map<String, Object> details = new LinkedHashMap<>();
            details.put("Chuồng nuôi", barn.getName());
            details.put("Trọng lượng TB", avgWeight + " kg / con");
            details.put("Cỡ mẫu cân", sampleSize + " con");

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("actionType", "LOG_WEIGHT");
            payload.put("barnId", barn.getId());
            payload.put("cycleId", cycle.getId());
            payload.put("barnName", barn.getName());
            payload.put("avgWeight", avgWeight);
            payload.put("sampleSize", sampleSize);

            return AiAssistantResponse.builder()
                    .reply("Bạn có muốn ghi nhận kết quả cân mẫu cho **" + barn.getName() + "**: trung bình **" + avgWeight + " kg** (mẫu " + sampleSize + " con) không?")
                    .actionType("LOG_WEIGHT")
                    .executed(false)
                    .requiresConfirmation(true)
                    .pendingAction(Map.of(
                            "actionType", "LOG_WEIGHT",
                            "title", "Ghi nhận cân mẫu: " + barn.getName(),
                            "description", "Trọng lượng TB " + avgWeight + " kg (mẫu " + sampleSize + " con)",
                            "details", details,
                            "payload", payload
                    ))
                    .build();
        }

        return commitLogWeight(barn, cycle, avgWeight, sampleSize, username);
    }

    private AiAssistantResponse commitLogWeight(Barn barn, FarmingCycle cycle, double avgWeight, int sampleSize, String username) {
        WeightSample sample = new WeightSample();
        sample.setCycle(cycle);
        sample.setSampleDate(LocalDate.now());
        sample.setAvgWeightKg(BigDecimal.valueOf(avgWeight));
        sample.setSampleSize(sampleSize);
        sample.setNote("Cân mẫu tự động qua Trợ lý Giọng nói FarmShift AI");
        sample.setCreatedBy(username != null && !username.isBlank() ? username : "Trợ lý AI");
        weightRepository.save(sample);

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("title", "Đã ghi nhận cân mẫu");
        summary.put("barnName", barn.getName());
        summary.put("detail", avgWeight + " kg • Mẫu " + sampleSize + " con");
        summary.put("avgWeight", String.valueOf(avgWeight));
        summary.put("sampleSize", String.valueOf(sampleSize));
        summary.put("timestamp", LocalDateTime.now().toString());

        return AiAssistantResponse.builder()
                .reply("✅ Đã ghi nhận kết quả cân mẫu cho **" + barn.getName() + "**: trọng lượng trung bình **" + avgWeight + " kg** (mẫu " + sampleSize + " con). Đồ thị tăng trưởng đàn gà đã được cập nhật.")
                .actionType("LOG_WEIGHT")
                .executed(true)
                .uiCommand("REFRESH_DATA")
                .actionSummary(summary)
                .build();
    }

    private AiAssistantResponse handleLogMortality(String norm, String originalMsg, String username) {
        return handleLogMortality(norm, originalMsg, null, username, true);
    }

    private AiAssistantResponse handleLogMortality(String norm, String originalMsg, String currentRoute, String username) {
        return handleLogMortality(norm, originalMsg, currentRoute, username, true);
    }

    private AiAssistantResponse handleLogMortality(String norm, String originalMsg, String currentRoute, String username, boolean autoExecute) {
        Barn barn = resolveBarn(norm, originalMsg, currentRoute);
        if (barn == null) {
            if (hasBarnMention(norm, currentRoute)) {
                return barnNotFoundResponse(norm);
            }
            return null;
        }

        Optional<FarmingCycle> cycleOpt = cycleRepository.findFirstByBarnIdAndStatus(barn.getId(), CycleStatus.ACTIVE);
        if (cycleOpt.isEmpty()) {
            return cycleNotFoundResponse(barn);
        }

        FarmingCycle cycle = cycleOpt.get();

        // Find active flock
        List<Flock> flocks = flockRepository.findAllByCycleIdOrderByImportDateAscIdAsc(cycle.getId());
        Flock flock = flocks.stream()
                .filter(f -> f.getStatus() == FlockStatus.ACTIVE)
                .findFirst()
                .orElse(null);

        int qty = 1;
        Matcher numMatcher = Pattern.compile("(\\d+)\\s*con").matcher(norm);
        if (numMatcher.find()) {
            qty = Integer.parseInt(numMatcher.group(1));
        } else {
            Matcher altMatcher = Pattern.compile("(?:hao hut|chet|loai thai|xuat ban|thu hoach|xuat)\\s*(\\d+)").matcher(norm);
            if (altMatcher.find()) {
                qty = Integer.parseInt(altMatcher.group(1));
            }
        }

        FlockMovementType movementType = FlockMovementType.DEATH;
        String reason = "Hao hụt chăn nuôi";
        if (norm.contains("xuat ban") || norm.contains("thu hoach") || norm.contains("xuat")) {
            movementType = FlockMovementType.HARVEST;
            reason = "Xuất bán gà";
        } else if (norm.contains("loai thai")) {
            movementType = FlockMovementType.CULL;
            reason = "Loại thải con còi cọc";
        } else if (norm.contains("nong")) {
            reason = "Hao hụt do nắng nóng";
        } else if (norm.contains("dich")) {
            reason = "Hao hụt do dịch bệnh";
        } else if (norm.contains("benh")) {
            reason = "Hao hụt do bệnh";
        }

        String actionLabel = movementType == FlockMovementType.HARVEST ? "xuất bán" : (movementType == FlockMovementType.CULL ? "loại thải" : "hao hụt");

        if (!autoExecute) {
            Map<String, Object> details = new LinkedHashMap<>();
            details.put("Chuồng nuôi", barn.getName());
            details.put("Số lượng " + actionLabel, qty + " con");
            details.put("Lý do", reason);
            details.put("Đàn còn lại dự kiến", (Math.max(0, barn.getCurrentQuantity() - qty)) + " con");

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("actionType", "LOG_MORTALITY");
            payload.put("movementType", movementType.name());
            payload.put("barnId", barn.getId());
            payload.put("barnName", barn.getName());
            if (flock != null) payload.put("flockId", flock.getId());
            payload.put("quantity", qty);
            payload.put("reason", reason);

            return AiAssistantResponse.builder()
                    .reply("Bạn có muốn ghi nhận " + actionLabel + " **" + qty + " con** (" + reason.toLowerCase() + ") cho chuồng **" + barn.getName() + "** không?")
                    .actionType("LOG_MORTALITY")
                    .executed(false)
                    .requiresConfirmation(true)
                    .pendingAction(Map.of(
                            "actionType", "LOG_MORTALITY",
                            "title", "Ghi nhận " + actionLabel + ": " + barn.getName(),
                            "description", (movementType == FlockMovementType.HARVEST ? "Xuất bán " : (movementType == FlockMovementType.CULL ? "Loại thải " : "Hao hụt ")) + qty + " con (" + reason + ")",
                            "details", details,
                            "payload", payload
                    ))
                    .build();
        }

        return commitLogMortality(barn, flock, qty, reason, movementType, username);
    }

    private AiAssistantResponse commitLogMortality(Barn barn, Flock flock, int qty, String reason, String username) {
        return commitLogMortality(barn, flock, qty, reason, FlockMovementType.DEATH, username);
    }

    private AiAssistantResponse commitLogMortality(Barn barn, Flock flock, int qty, String reason, FlockMovementType movementType, String username) {
        if (flock != null) {
            FlockMovement movement = new FlockMovement();
            movement.setFlock(flock);
            movement.setType(movementType != null ? movementType : FlockMovementType.DEATH);
            movement.setMovementDate(LocalDate.now());
            movement.setQuantity(qty);
            movement.setNote(reason + " (Ghi nhận bằng Trợ lý AI)");
            movement.setCreatedBy(username != null && !username.isBlank() ? username : "Trợ lý AI");
            movementRepository.save(movement);

            flock.setQuantity(Math.max(0, flock.getQuantity() - qty));
            if (flock.getQuantity() == 0) {
                flock.setStatus(FlockStatus.ARCHIVED);
            }
            flockRepository.save(flock);
        }

        barn.setCurrentQuantity(Math.max(0, barn.getCurrentQuantity() - qty));
        barnRepository.save(barn);

        String actionLabel = movementType == FlockMovementType.HARVEST ? "xuất bán" : (movementType == FlockMovementType.CULL ? "loại thải" : "hao hụt");
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("title", "Đã ghi nhận " + actionLabel);
        summary.put("barnName", barn.getName());
        summary.put("detail", (movementType == FlockMovementType.HARVEST ? "Xuất bán " : (movementType == FlockMovementType.CULL ? "Loại thải " : "Hao hụt ")) + qty + " con • " + reason);
        summary.put("quantity", String.valueOf(qty));
        summary.put("remainingQuantity", String.valueOf(barn.getCurrentQuantity()));
        summary.put("reason", reason);
        summary.put("timestamp", LocalDateTime.now().toString());

        return AiAssistantResponse.builder()
                .reply("✅ Đã ghi nhận " + actionLabel + " **" + qty + " con** (" + reason.toLowerCase() + ") tại **" + barn.getName() + "**. Số lượng gà hiện tại của chuồng còn **" + NumberFormat.getInstance(new Locale("vi", "VN")).format(barn.getCurrentQuantity()) + " con**.")
                .actionType("LOG_MORTALITY")
                .executed(true)
                .uiCommand("REFRESH_DATA")
                .actionSummary(summary)
                .build();
    }

    private AiAssistantResponse handleLogExpense(String norm, String originalMsg, String username) {
        return handleLogExpense(norm, originalMsg, null, username, true);
    }

    private AiAssistantResponse handleLogExpense(String norm, String originalMsg, String currentRoute, String username) {
        return handleLogExpense(norm, originalMsg, currentRoute, username, true);
    }

    private AiAssistantResponse handleLogExpense(String norm, String originalMsg, String currentRoute, String username, boolean autoExecute) {
        Barn barn = resolveBarn(norm, originalMsg, currentRoute);
        if (barn == null) {
            if (hasBarnMention(norm, currentRoute)) {
                return barnNotFoundResponse(norm);
            }
            return null;
        }

        Optional<FarmingCycle> cycleOpt = cycleRepository.findFirstByBarnIdAndStatus(barn.getId(), CycleStatus.ACTIVE);
        if (cycleOpt.isEmpty()) {
            return cycleNotFoundResponse(barn);
        }

        FarmingCycle cycle = cycleOpt.get();

        ExpenseCategory category = ExpenseCategory.OTHER;
        String categoryLabel = "Chi phí khác";

        if (norm.contains("dien")) {
            category = ExpenseCategory.ELECTRICITY;
            categoryLabel = "Tiền điện";
        } else if (norm.contains("nuoc")) {
            category = ExpenseCategory.WATER;
            categoryLabel = "Tiền nước";
        } else if (norm.contains("thuoc")) {
            category = ExpenseCategory.MEDICINE;
            categoryLabel = "Tiền thuốc thú y";
        } else if (norm.contains("cong") || norm.contains("nhan cong")) {
            category = ExpenseCategory.LABOR;
            categoryLabel = "Tiền công";
        }

        long amount = 500000L;
        Long spokenMoney = VietnameseSpeechNormalizer.extractMoney(norm);
        if (spokenMoney != null) {
            amount = spokenMoney;
        }

        String formattedMoney = NumberFormat.getInstance(new Locale("vi", "VN")).format(amount) + " đ";

        if (!autoExecute) {
            Map<String, Object> details = new LinkedHashMap<>();
            details.put("Chuồng nuôi", barn.getName());
            details.put("Hạng mục", categoryLabel);
            details.put("Số tiền", formattedMoney);
            details.put("Lứa nuôi", "Lứa #" + cycle.getCycleNumber());

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("actionType", "LOG_EXPENSE");
            payload.put("barnId", barn.getId());
            payload.put("cycleId", cycle.getId());
            payload.put("barnName", barn.getName());
            payload.put("category", category.name());
            payload.put("categoryLabel", categoryLabel);
            payload.put("amount", amount);

            return AiAssistantResponse.builder()
                    .reply("Bạn có muốn ghi nhận chi phí **" + categoryLabel + "** số tiền **" + formattedMoney + "** cho **" + barn.getName() + "** không?")
                    .actionType("LOG_EXPENSE")
                    .executed(false)
                    .requiresConfirmation(true)
                    .pendingAction(Map.of(
                            "actionType", "LOG_EXPENSE",
                            "title", "Ghi nhận chi phí: " + barn.getName(),
                            "description", categoryLabel + " • " + formattedMoney,
                            "details", details,
                            "payload", payload
                    ))
                    .build();
        }

        return commitLogExpense(barn, cycle, category, categoryLabel, amount, username);
    }

    private AiAssistantResponse commitLogExpense(Barn barn, FarmingCycle cycle, ExpenseCategory category, String categoryLabel, long amount, String username) {
        CycleExpense expense = new CycleExpense();
        expense.setCycle(cycle);
        expense.setExpenseDate(LocalDate.now());
        expense.setCategory(category);
        expense.setAmount(BigDecimal.valueOf(amount));
        expense.setNote("Ghi nhận tự động qua Trợ lý Giọng nói FarmShift AI");
        expense.setCreatedBy(username != null && !username.isBlank() ? username : "Trợ lý AI");
        expenseRepository.save(expense);

        String formattedMoney = NumberFormat.getInstance(new Locale("vi", "VN")).format(amount) + " đ";
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("title", "Đã ghi chi phí lứa nuôi");
        summary.put("barnName", barn.getName());
        summary.put("detail", categoryLabel + " • " + formattedMoney);
        summary.put("category", category.name());
        summary.put("amount", String.valueOf(amount));
        summary.put("timestamp", LocalDateTime.now().toString());

        return AiAssistantResponse.builder()
                .reply("✅ Đã ghi chi phí **" + categoryLabel + "** cho **" + barn.getName() + "** với số tiền **" + formattedMoney + "** vào lứa nuôi hiện tại.")
                .actionType("LOG_EXPENSE")
                .executed(true)
                .uiCommand("REFRESH_DATA")
                .actionSummary(summary)
                .build();
    }

    private AiAssistantResponse handleCreateBarn(String norm, String originalMsg, boolean autoExecute) {
        double floorArea = 500.0;
        Matcher areaMatcher = Pattern.compile("(?:dien tich|dt|rong)\\s*[:=]?\\s*(\\d+(?:[.,]\\d+)?)\\s*(?:m2|m\\^2|met vuong|m)?").matcher(norm);
        if (areaMatcher.find()) {
            floorArea = Double.parseDouble(areaMatcher.group(1).replace(',', '.'));
        }

        String cleanNorm = norm.replaceAll("(?:dien tich|dt|rong)\\s*[:=]?\\s*\\d+(?:[.,]\\d+)?\\s*(?:m2|m\\^2|met vuong|m)?", "").trim();
        Matcher nameMatcher = Pattern.compile("(?:tao|them|tao moi|them moi)?\\s*(?:chuong|nha)\\s+([a-zA-Z0-9_\\-]+)").matcher(cleanNorm);
        String barnName = null;
        if (nameMatcher.find()) {
            barnName = nameMatcher.group(1).trim();
        } else {
            Matcher fallbackMatcher = Pattern.compile("(?:chuong|nha)\\s+([a-zA-Z0-9_\\-]+)").matcher(norm);
            if (fallbackMatcher.find()) {
                barnName = fallbackMatcher.group(1).trim();
            }
        }

        if (barnName == null || barnName.isBlank()) {
            return AiAssistantResponse.builder()
                    .reply("⚠️ Vui lòng chỉ rõ tên chuồng bạn muốn tạo (ví dụ: *Tạo chuồng B1 diện tích 600m2*).")
                    .actionType("CREATE_BARN")
                    .executed(false)
                    .build();
        }

        if (!barnName.toLowerCase().startsWith("nhà") && !barnName.toLowerCase().startsWith("chuồng") && !barnName.toLowerCase().startsWith("nha")) {
            barnName = "Nhà " + barnName.toUpperCase();
        }

        final String finalBarnName = barnName;
        boolean exists = barnRepository.findAll().stream().anyMatch(b -> b.getName().equalsIgnoreCase(finalBarnName));
        if (exists) {
            return AiAssistantResponse.builder()
                    .reply("⚠️ Chuồng **" + barnName + "** đã tồn tại trong hệ thống. Vui lòng chọn tên khác.")
                    .actionType("CREATE_BARN")
                    .executed(false)
                    .build();
        }

        List<FarmArea> areas = areaRepository.findAll();
        FarmArea area = areas.isEmpty() ? null : areas.get(0);
        Long areaId = area != null ? area.getId() : 1L;
        String areaName = area != null ? area.getName() : "Khu nuôi tiêu chuẩn";
        int capacity = (int) Math.round(floorArea * 8.0);

        if (!autoExecute) {
            Map<String, Object> details = new LinkedHashMap<>();
            details.put("Tên chuồng", barnName);
            details.put("Diện tích sàn", floorArea + " m²");
            details.put("Sức chứa tiêu chuẩn", capacity + " con (8 con/m²)");
            details.put("Khu vực thuộc về", areaName);

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("actionType", "CREATE_BARN");
            payload.put("name", barnName);
            payload.put("floorArea", floorArea);
            payload.put("capacity", capacity);
            payload.put("areaId", areaId);

            return AiAssistantResponse.builder()
                    .reply("Bạn có muốn tạo chuồng nuôi mới **" + barnName + "** với diện tích sàn **" + floorArea + " m²** (sức chứa **" + capacity + " con**) thuộc **" + areaName + "** không?")
                    .actionType("CREATE_BARN")
                    .executed(false)
                    .requiresConfirmation(true)
                    .pendingAction(Map.of(
                            "actionType", "CREATE_BARN",
                            "title", "Tạo chuồng nuôi mới: " + barnName,
                            "description", "Chuồng " + barnName + " • " + floorArea + " m² • " + capacity + " con",
                            "details", details,
                            "payload", payload
                    ))
                    .build();
        }

        return commitCreateBarn(barnName, floorArea, capacity, areaId);
    }

    private AiAssistantResponse commitCreateBarn(String name, double floorArea, int capacity, Long areaId) {
        BarnRequest req = new BarnRequest(
                areaId,
                name,
                capacity,
                BigDecimal.valueOf(floorArea),
                BigDecimal.ZERO,
                "Tạo bởi AI Assistant"
        );
        barnService.create(req);

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("title", "Đã tạo chuồng mới");
        summary.put("barnName", name);
        summary.put("detail", floorArea + " m² • Sức chứa " + capacity + " con");
        summary.put("timestamp", LocalDateTime.now().toString());

        return AiAssistantResponse.builder()
                .reply("✅ Đã tạo thành công chuồng nuôi **" + name + "** (Diện tích " + floorArea + " m², sức chứa " + capacity + " con). Bạn có thể vào màn hình **Chuồng nuôi** để xem chi tiết.")
                .actionType("CREATE_BARN")
                .executed(true)
                .navigateTo("/barns")
                .uiCommand("REFRESH_DATA")
                .actionSummary(summary)
                .build();
    }

    private AiAssistantResponse handleCreateSupplier(String norm, String originalMsg, boolean autoExecute) {
        String phone = null;
        Matcher phoneMatcher = Pattern.compile("(\\b0[0-9]{9,10}\\b)").matcher(norm);
        if (phoneMatcher.find()) {
            phone = phoneMatcher.group(1).trim();
        }

        String cleanOrig = phone != null ? originalMsg.replace(phone, "").trim() : originalMsg;
        cleanOrig = cleanOrig.replaceAll("(?i)\\b(?:sdt|so dien thoai|phone|dien thoai)\\b", "").trim();
        Matcher matcherOrig = Pattern.compile("(?i)(?:tạo|thêm|thêm mới|tạo mới|tao|them|them moi|tao moi)\\s+(?:nhà cung cấp|nha cung cap|ncc|đối tác|doi tac)\\s+(.+)").matcher(cleanOrig);
        String name = null;
        if (matcherOrig.find()) {
            name = matcherOrig.group(1).trim();
            name = Character.toUpperCase(name.charAt(0)) + (name.length() > 1 ? name.substring(1) : "");
        } else {
            String cleanNorm = phone != null ? norm.replace(phone, "").trim() : norm;
            cleanNorm = cleanNorm.replaceAll("\\b(?:sdt|so dien thoai|phone|dien thoai)\\b", "").trim();
            Matcher matcher = Pattern.compile("(?:tao|them|them moi|tao moi)\\s+(?:nha cung cap|ncc|doi tac)\\s+(.+)").matcher(cleanNorm);
            if (matcher.find()) {
                name = matcher.group(1).trim();
                name = Character.toUpperCase(name.charAt(0)) + (name.length() > 1 ? name.substring(1) : "");
            }
        }
        if (name == null || name.isBlank()) {
            return AiAssistantResponse.builder()
                    .reply("⚠️ Vui lòng cung cấp tên nhà cung cấp (ví dụ: *Thêm nhà cung cấp cám CP 0912345678*).")
                    .actionType("CREATE_SUPPLIER")
                    .executed(false)
                    .build();
        }

        final String finalName = name;
        boolean exists = supplierRepository.findAll().stream().anyMatch(s -> s.getName().equalsIgnoreCase(finalName));
        if (exists) {
            return AiAssistantResponse.builder()
                    .reply("⚠️ Nhà cung cấp **" + name + "** đã có trong danh mục đối tác.")
                    .actionType("CREATE_SUPPLIER")
                    .executed(false)
                    .build();
        }

        if (!autoExecute) {
            Map<String, Object> details = new LinkedHashMap<>();
            details.put("Tên đối tác", name);
            details.put("Số điện thoại", phone != null ? phone : "Chưa cập nhật");
            details.put("Danh mục", "Thức ăn chăn nuôi & Vật tư");

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("actionType", "CREATE_SUPPLIER");
            payload.put("name", name);
            if (phone != null) payload.put("phone", phone);

            return AiAssistantResponse.builder()
                    .reply("Bạn có muốn thêm nhà cung cấp mới **" + name + "**" + (phone != null ? (" (SĐT: " + phone + ")") : "") + " vào hệ thống không?")
                    .actionType("CREATE_SUPPLIER")
                    .executed(false)
                    .requiresConfirmation(true)
                    .pendingAction(Map.of(
                            "actionType", "CREATE_SUPPLIER",
                            "title", "Thêm nhà cung cấp mới: " + name,
                            "description", name + (phone != null ? (" • SĐT: " + phone) : ""),
                            "details", details,
                            "payload", payload
                    ))
                    .build();
        }

        return commitCreateSupplier(name, phone);
    }

    private AiAssistantResponse commitCreateSupplier(String name, String phone) {
        String contactPhone = (phone != null && phone.matches("^(?:(?:024|028)[0-9]{8}|(?!(?:024|028))[0-9]{10})$")) ? phone : "0901234567";
        SupplierRequest req = new SupplierRequest(name, "Đại diện đối tác", contactPhone, null);
        supplierService.create(req);

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("title", "Đã thêm nhà cung cấp");
        summary.put("detail", name + (phone != null ? (" • SĐT: " + phone) : ""));
        summary.put("timestamp", LocalDateTime.now().toString());

        return AiAssistantResponse.builder()
                .reply("✅ Đã thêm thành công nhà cung cấp **" + name + "** vào danh mục đối tác.")
                .actionType("CREATE_SUPPLIER")
                .executed(true)
                .navigateTo("/purchases")
                .uiCommand("REFRESH_DATA")
                .actionSummary(summary)
                .build();
    }

    private AiAssistantResponse handleCreateArea(String norm, String originalMsg, boolean autoExecute) {
        String name = null;
        Matcher matcherOrig = Pattern.compile("(?i)(?:tạo mới|thêm mới|tao moi|them moi|tạo|thêm|tao|them)\\s+(?:khu vực|khu nuôi|khu vuc|khu nuoi|khu)\\s+(.+)").matcher(originalMsg);
        if (matcherOrig.find()) {
            name = matcherOrig.group(1).trim();
        } else {
            Matcher matcher = Pattern.compile("(?:tao moi|them moi|tao|them)\\s+(?:khu vuc|khu nuoi|khu)\\s+(.+)").matcher(norm);
            if (matcher.find()) {
                name = matcher.group(1).trim();
                name = Character.toUpperCase(name.charAt(0)) + (name.length() > 1 ? name.substring(1) : "");
            }
        }
        if (name == null || name.isBlank()) {
            return AiAssistantResponse.builder()
                    .reply("⚠️ Vui lòng cung cấp tên khu vực (ví dụ: *Thêm khu vực Khu Nuôi Gà Thịt*).")
                    .actionType("CREATE_AREA")
                    .executed(false)
                    .build();
        }

        final String finalName = name;
        boolean exists = areaRepository.findAll().stream().anyMatch(a -> a.getName().equalsIgnoreCase(finalName));
        if (exists) {
            return AiAssistantResponse.builder()
                    .reply("⚠️ Khu vực **" + name + "** đã tồn tại trong trang trại.")
                    .actionType("CREATE_AREA")
                    .executed(false)
                    .build();
        }

        if (!autoExecute) {
            Map<String, Object> details = new LinkedHashMap<>();
            details.put("Tên khu vực", name);
            details.put("Theo dõi môi trường", "Nhiệt độ, Độ ẩm");
            details.put("Theo dõi đàn", "Cân mẫu, Hao hụt");

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("actionType", "CREATE_AREA");
            payload.put("name", name);

            return AiAssistantResponse.builder()
                    .reply("Bạn có muốn tạo khu vực chăn nuôi mới **" + name + "** không?")
                    .actionType("CREATE_AREA")
                    .executed(false)
                    .requiresConfirmation(true)
                    .pendingAction(Map.of(
                            "actionType", "CREATE_AREA",
                            "title", "Tạo khu vực mới: " + name,
                            "description", "Khu vực: " + name,
                            "details", details,
                            "payload", payload
                    ))
                    .build();
        }

        return commitCreateArea(name);
    }

    private AiAssistantResponse commitCreateArea(String name) {
        FarmAreaRequest req = new FarmAreaRequest(
                name,
                FarmAreaService.ENVIRONMENT_METRICS,
                FarmAreaService.ANIMAL_METRICS,
                "Tạo bởi AI Assistant"
        );
        farmAreaService.create(req);

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("title", "Đã tạo khu vực mới");
        summary.put("detail", "Khu: " + name);
        summary.put("timestamp", LocalDateTime.now().toString());

        return AiAssistantResponse.builder()
                .reply("✅ Đã tạo thành công khu vực chăn nuôi **" + name + "** trên hệ thống.")
                .actionType("CREATE_AREA")
                .executed(true)
                .navigateTo("/barns")
                .uiCommand("REFRESH_DATA")
                .actionSummary(summary)
                .build();
    }

    public AiAssistantResponse executeMutationPayload(Map<String, Object> payload, String username) {
        if (payload == null) return null;
        String actionType = payload.get("actionType") != null ? String.valueOf(payload.get("actionType")) : "";
        switch (actionType) {
            case "UPDATE_BARN_INFO": {
                Long barnId = payload.get("barnId") != null ? Long.valueOf(String.valueOf(payload.get("barnId"))) : null;
                Barn barn = null;
                if (barnId != null) {
                    barn = barnRepository.findById(barnId).orElse(null);
                } else if (payload.containsKey("barnName")) {
                    barn = barnRepository.findAll().stream()
                            .filter(b -> b.getName().equalsIgnoreCase(String.valueOf(payload.get("barnName"))))
                            .findFirst().orElse(null);
                }
                if (barn == null) {
                    return AiAssistantResponse.builder().reply("⚠️ Không tìm thấy chuồng để cập nhật.").executed(false).build();
                }
                if (payload.containsKey("capacity")) {
                    int newCap = Integer.parseInt(String.valueOf(payload.get("capacity")));
                    int curQty = barn.getCurrentQuantity();
                    if (newCap < curQty) {
                        return AiAssistantResponse.builder()
                                .reply("⚠️ Sức chứa mới (" + newCap + " con) không thể nhỏ hơn số gà đang nuôi (" + curQty + " con) trong chuồng **" + barn.getName() + "**.")
                                .executed(false)
                                .actionType("UPDATE_BARN_INFO")
                                .build();
                    }
                    barn.setCapacity(newCap);
                }
                if (payload.containsKey("areaM2")) {
                    barn.setAreaM2(BigDecimal.valueOf(Double.parseDouble(String.valueOf(payload.get("areaM2")))));
                }
                if (payload.containsKey("targetWeight")) {
                    barn.setTargetWeight(BigDecimal.valueOf(Double.parseDouble(String.valueOf(payload.get("targetWeight")))));
                }
                if (payload.containsKey("name")) {
                    String newName = FarmAreaService.normalizeName(String.valueOf(payload.get("name")));
                    String newKey = newName.toLowerCase(Locale.ROOT);
                    if (newName.isBlank() || newName.length() > 100) {
                        return AiAssistantResponse.builder().reply("⚠️ Tên chuồng mới không hợp lệ (1-100 ký tự).").actionType("UPDATE_BARN_INFO").executed(false).build();
                    }
                    if (barn.getArea() != null && barnRepository.existsByAreaIdAndNameKeyAndIdNot(barn.getArea().getId(), newKey, barn.getId())) {
                        return AiAssistantResponse.builder()
                                .reply("⚠️ Tên chuồng **" + newName + "** đã tồn tại trong khu " + barn.getArea().getName() + ".")
                                .actionType("UPDATE_BARN_INFO").executed(false).build();
                    }
                    barn.setName(newName);
                    barn.setNameKey(newKey);
                }
                Barn saved = barnRepository.save(barn);
                Map<String, Object> summary = new LinkedHashMap<>();
                summary.put("title", "Đã cập nhật chuồng " + saved.getName());
                summary.put("barnId", saved.getId());
                summary.put("barnName", saved.getName());
                summary.put("capacity", saved.getCapacity());
                summary.put("areaM2", saved.getAreaM2());
                summary.put("timestamp", LocalDateTime.now().toString());

                return AiAssistantResponse.builder()
                        .reply("✅ Đã cập nhật thành công thông tin chuồng **" + saved.getName() + "**: Sức chứa " + saved.getCapacity() + " con, Diện tích " + (saved.getAreaM2() != null ? saved.getAreaM2() : "-") + " m².")
                        .actionType("UPDATE_BARN_INFO")
                        .executed(true)
                        .navigateTo("/barns")
                        .uiCommand("REFRESH_DATA")
                        .actionSummary(summary)
                        .actionContext(Map.of("lastIntent", "UPDATE_BARN_INFO", "barnId", saved.getId(), "barnName", saved.getName()))
                        .build();
            }

            case "UPDATE_INVENTORY_ITEM": {
                Long itemId = payload.get("itemId") != null ? Long.valueOf(String.valueOf(payload.get("itemId"))) : null;
                InventoryItem item = null;
                if (itemId != null) {
                    item = inventoryRepository.findById(itemId).orElse(null);
                } else if (payload.containsKey("productName")) {
                    String pName = String.valueOf(payload.get("productName"));
                    item = FuzzyEntityResolver.findEntityInText(pName, inventoryRepository.findAll(), i -> i.getProduct() != null ? i.getProduct().getName() : "", 0.35);
                }
                if (item == null) {
                    return AiAssistantResponse.builder().reply("⚠️ Không tìm thấy vật tư trong kho để cập nhật.").executed(false).build();
                }
                String name = item.getProduct() != null ? item.getProduct().getName() : "Vật tư";
                if (payload.containsKey("price")) {
                    BigDecimal price = BigDecimal.valueOf(Double.parseDouble(String.valueOf(payload.get("price"))));
                    item.setPrice(price);
                }
                if (payload.containsKey("stock")) {
                    BigDecimal stock = BigDecimal.valueOf(Double.parseDouble(String.valueOf(payload.get("stock"))));
                    item.setStock(stock);
                }
                InventoryItem saved = inventoryRepository.save(item);
                String priceFormatted = saved.getPrice() != null ? NumberFormat.getInstance(new Locale("vi", "VN")).format(saved.getPrice()) + " đ" : "chưa đặt";
                Map<String, Object> summary = new LinkedHashMap<>();
                summary.put("title", "Đã cập nhật vật tư: " + name);
                summary.put("itemId", saved.getId());
                summary.put("itemName", name);
                summary.put("price", saved.getPrice());
                summary.put("stock", saved.getStock());
                summary.put("timestamp", LocalDateTime.now().toString());

                return AiAssistantResponse.builder()
                        .reply("✅ Đã cập nhật thành công vật tư **" + name + "**: Đơn giá " + priceFormatted + ", Tồn kho " + saved.getStock() + " " + (saved.getUnit() != null ? saved.getUnit().getName() : "") + ".")
                        .actionType("UPDATE_INVENTORY_ITEM")
                        .executed(true)
                        .navigateTo("/inventory")
                        .uiCommand("REFRESH_DATA")
                        .actionSummary(summary)
                        .actionContext(Map.of("lastIntent", "UPDATE_INVENTORY_ITEM", "itemId", saved.getId(), "itemName", name))
                        .build();
            }

            case "UPDATE_SUPPLIER_INFO": {
                Long supplierId = payload.get("supplierId") != null ? Long.valueOf(String.valueOf(payload.get("supplierId"))) : null;
                Supplier supplier = null;
                if (supplierId != null) {
                    supplier = supplierRepository.findById(supplierId).orElse(null);
                } else if (payload.containsKey("supplierName")) {
                    String sName = String.valueOf(payload.get("supplierName"));
                    supplier = FuzzyEntityResolver.findEntityInText(sName, supplierRepository.findAll(), Supplier::getName, 0.35);
                }
                if (supplier == null) {
                    return AiAssistantResponse.builder().reply("⚠️ Không tìm thấy nhà cung cấp để cập nhật.").executed(false).build();
                }
                if (payload.containsKey("phone")) {
                    supplier.setPhone(String.valueOf(payload.get("phone")));
                }
                if (payload.containsKey("paymentPolicy")) {
                    supplier.setPaymentPolicy(String.valueOf(payload.get("paymentPolicy")));
                }
                if (payload.containsKey("representative")) {
                    supplier.setRepresentative(String.valueOf(payload.get("representative")));
                }
                if (payload.containsKey("address")) {
                    supplier.setAddress(String.valueOf(payload.get("address")));
                }
                if (payload.containsKey("openingDebt")) {
                    supplier.setOpeningDebt(Long.valueOf(String.valueOf(payload.get("openingDebt"))));
                }
                Supplier saved = supplierRepository.save(supplier);
                Map<String, Object> summary = new LinkedHashMap<>();
                summary.put("title", "Đã cập nhật NCC: " + saved.getName());
                summary.put("supplierId", saved.getId());
                summary.put("name", saved.getName());
                summary.put("phone", saved.getPhone());
                summary.put("policy", saved.getPaymentPolicy());

                return AiAssistantResponse.builder()
                        .reply("✅ Đã cập nhật thành công thông tin nhà cung cấp **" + saved.getName() + "**: SĐT " + (saved.getPhone() != null ? saved.getPhone() : "-") + ", Chính sách: " + (saved.getPaymentPolicy() != null ? saved.getPaymentPolicy() : "-") + ".")
                        .actionType("UPDATE_SUPPLIER_INFO")
                        .executed(true)
                        .navigateTo("/purchases")
                        .uiCommand("REFRESH_DATA")
                        .actionSummary(summary)
                        .actionContext(Map.of("lastIntent", "UPDATE_SUPPLIER_INFO", "supplierId", saved.getId(), "supplierName", saved.getName()))
                        .build();
            }

            case "PAY_PURCHASE_INVOICE": {
                String invoiceCode = String.valueOf(payload.get("invoiceCode"));
                Long invoiceId = payload.get("invoiceId") != null ? Long.valueOf(String.valueOf(payload.get("invoiceId"))) : null;
                PurchaseInvoice invoice = invoiceId != null ? invoiceRepository.findById(invoiceId).orElse(null) : invoiceRepository.findByCode(invoiceCode).orElse(null);
                if (invoice == null) {
                    return AiAssistantResponse.builder().reply("⚠️ Không tìm thấy hóa đơn " + invoiceCode + " để thanh toán.").executed(false).build();
                }
                long amount = Long.parseLong(String.valueOf(payload.getOrDefault("amount", invoice.getTotalAmount() - invoice.getPaidAmount())));
                if (amount <= 0) {
                    return AiAssistantResponse.builder().reply("⚠️ Số tiền thanh toán phải lớn hơn 0.").executed(false).build();
                }
                var updated = purchaseService.pay(invoice.getId(), new PurchasePaymentRequest(amount, "Thanh toán qua Trợ lý AI"));
                String moneyFormatted = NumberFormat.getInstance(new Locale("vi", "VN")).format(amount) + " đ";
                Map<String, Object> summary = new LinkedHashMap<>();
                summary.put("title", "Đã thanh toán hóa đơn " + updated.code());
                summary.put("invoiceCode", updated.code());
                summary.put("paidAmount", moneyFormatted);
                summary.put("paymentStatus", updated.paymentStatus());

                return AiAssistantResponse.builder()
                        .reply("✅ Đã ghi nhận thanh toán **" + moneyFormatted + "** cho hóa đơn **" + updated.code() + "**. Trạng thái thanh toán hiện tại: **" + updated.paymentStatus() + "**.")
                        .actionType("PAY_PURCHASE_INVOICE")
                        .executed(true)
                        .navigateTo("/purchases")
                        .uiCommand("REFRESH_DATA")
                        .actionSummary(summary)
                        .actionContext(Map.of("lastIntent", "PAY_PURCHASE_INVOICE", "invoiceCode", updated.code(), "invoiceId", updated.id()))
                        .build();
            }

            case "CANCEL_PURCHASE_INVOICE": {
                String invoiceCode = String.valueOf(payload.get("invoiceCode"));
                Long invoiceId = payload.get("invoiceId") != null ? Long.valueOf(String.valueOf(payload.get("invoiceId"))) : null;
                PurchaseInvoice invoice = invoiceId != null ? invoiceRepository.findById(invoiceId).orElse(null) : invoiceRepository.findByCode(invoiceCode).orElse(null);
                if (invoice == null) {
                    return AiAssistantResponse.builder().reply("⚠️ Không tìm thấy hóa đơn " + invoiceCode + " để hủy.").executed(false).build();
                }
                try {
                    purchaseService.cancel(invoice.getId());
                    return AiAssistantResponse.builder()
                            .reply("✅ Đã hủy thành công hóa đơn nhập hàng **" + invoice.getCode() + "**.")
                            .actionType("CANCEL_PURCHASE_INVOICE")
                            .executed(true)
                            .navigateTo("/purchases")
                            .uiCommand("REFRESH_DATA")
                            .actionSummary(Map.of("title", "Đã hủy hóa đơn " + invoice.getCode(), "invoiceCode", invoice.getCode()))
                            .actionContext(Map.of("lastIntent", "CANCEL_PURCHASE_INVOICE", "invoiceCode", invoice.getCode()))
                            .build();
                } catch (Exception ex) {
                    return AiAssistantResponse.builder()
                            .reply("⚠️ Không thể hủy hóa đơn " + invoice.getCode() + ": " + ex.getMessage())
                            .actionType("CANCEL_PURCHASE_INVOICE")
                            .executed(false)
                            .build();
                }
            }

            case "TRANSFER_FLOCK": {
                Long flockId = Long.valueOf(String.valueOf(payload.get("flockId")));
                Long targetBarnId = Long.valueOf(String.valueOf(payload.get("targetBarnId")));
                int quantity = Integer.parseInt(String.valueOf(payload.get("quantity")));
                String note = String.valueOf(payload.getOrDefault("note", "Chuyển đàn qua Trợ lý AI"));
                Flock flock = flockRepository.findById(flockId).orElse(null);
                Barn targetBarn = barnRepository.findById(targetBarnId).orElse(null);
                if (flock == null || targetBarn == null) {
                    return AiAssistantResponse.builder().reply("⚠️ Không tìm thấy thông tin đàn hoặc chuồng đích.").executed(false).build();
                }
                try {
                    var res = flockService.transfer(flockId, new FlockTransferRequest(targetBarnId, quantity, LocalDate.now(), null, null, note), username);
                    return AiAssistantResponse.builder()
                            .reply("✅ Đã chuyển thành công **" + quantity + " con gà** sang chuồng **" + targetBarn.getName() + "**.")
                            .actionType("TRANSFER_FLOCK")
                            .executed(true)
                            .navigateTo("/barns")
                            .uiCommand("REFRESH_DATA")
                            .actionSummary(Map.of("title", "Đã chuyển đàn", "quantity", quantity, "targetBarn", targetBarn.getName()))
                            .actionContext(Map.of("lastIntent", "TRANSFER_FLOCK", "targetBarnId", targetBarn.getId(), "targetBarnName", targetBarn.getName()))
                            .build();
                } catch (Exception ex) {
                    return AiAssistantResponse.builder()
                            .reply("⚠️ Chuyển đàn không thành công: " + ex.getMessage())
                            .actionType("TRANSFER_FLOCK")
                            .executed(false)
                            .build();
                }
            }

            case "START_OR_CLOSE_CYCLE":
            case "START_CYCLE": {
                Long barnId = Long.valueOf(String.valueOf(payload.get("barnId")));
                Barn barn = barnRepository.findById(barnId).orElse(null);
                if (barn == null) return AiAssistantResponse.builder().reply("⚠️ Không tìm thấy chuồng.").executed(false).build();
                try {
                    var res = cycleService.start(barnId, new StartCycleRequest(LocalDate.now(), null, "Mở lứa qua Trợ lý AI"));
                    return AiAssistantResponse.builder()
                            .reply("✅ Đã mở lứa nuôi mới (Lứa #" + res.cycleNumber() + ") cho chuồng **" + barn.getName() + "**.")
                            .actionType("START_OR_CLOSE_CYCLE")
                            .executed(true)
                            .navigateTo("/barns/" + barn.getId())
                            .uiCommand("REFRESH_DATA")
                            .build();
                } catch (Exception ex) {
                    return AiAssistantResponse.builder().reply("⚠️ Không thể mở lứa nuôi: " + ex.getMessage()).executed(false).build();
                }
            }

            case "CLOSE_CYCLE": {
                Long cycleId = Long.valueOf(String.valueOf(payload.get("cycleId")));
                try {
                    var res = cycleService.close(cycleId, new CloseCycleRequest(LocalDate.now(), "Đóng lứa qua Trợ lý AI"));
                    return AiAssistantResponse.builder()
                            .reply("✅ Đã đóng lứa nuôi #" + res.cycleNumber() + " thành công.")
                            .actionType("START_OR_CLOSE_CYCLE")
                            .executed(true)
                            .navigateTo("/barns")
                            .uiCommand("REFRESH_DATA")
                            .build();
                } catch (Exception ex) {
                    return AiAssistantResponse.builder().reply("⚠️ Không thể kết thúc lứa: " + ex.getMessage()).executed(false).build();
                }
            }

            case "LOG_OR_UPDATE_FEED":
            case "UPDATE_FEED": {
                Long recordId = payload.get("recordId") != null ? Long.valueOf(String.valueOf(payload.get("recordId"))) : null;
                FeedRecord record = recordId != null ? feedRepository.findById(recordId).orElse(null) : null;
                if (record == null) {
                    Long barnId = payload.get("barnId") != null ? Long.valueOf(String.valueOf(payload.get("barnId"))) : null;
                    if (barnId != null) {
                        record = feedRepository.findAllByCycleIdOrderByRecordDateDescIdDesc(
                                cycleRepository.findFirstByBarnIdAndStatus(barnId, CycleStatus.ACTIVE).map(FarmingCycle::getId).orElse(0L)
                        ).stream().findFirst().orElse(null);
                    }
                }
                if (record == null) {
                    return AiAssistantResponse.builder().reply("⚠️ Không tìm thấy nhật ký cám gần đây để sửa đổi.").executed(false).build();
                }
                double newKg = Double.parseDouble(String.valueOf(payload.get("newKg")));
                double oldKg = record.getQuantityKg() != null ? record.getQuantityKg().doubleValue() : 0.0;
                double delta = newKg - oldKg;
                record.setQuantityKg(BigDecimal.valueOf(newKg));
                record.setNote(record.getNote() != null ? record.getNote() + " | Sửa qua AI" : "Sửa qua AI");
                FeedRecord saved = feedRepository.save(record);
                deductInventoryStock(saved.getFeedName() != null ? saved.getFeedName() : "cám", delta);

                Barn b = saved.getCycle().getBarn();
                Map<String, Object> summary = new LinkedHashMap<>();
                summary.put("title", "Đã sửa nhật ký cám: " + (b != null ? b.getName() : ""));
                summary.put("barnId", b != null ? b.getId() : null);
                summary.put("barnName", b != null ? b.getName() : "");
                summary.put("oldQuantityKg", oldKg);
                summary.put("newQuantityKg", newKg);
                summary.put("recordId", saved.getId());

                return AiAssistantResponse.builder()
                        .reply("✅ Đã cập nhật lại lượng cám của **" + (b != null ? b.getName() : "chuồng") + "** từ **" + oldKg + " kg** thành **" + newKg + " kg**. Tồn kho vật tư đã được bù trừ tương ứng.")
                        .actionType("LOG_OR_UPDATE_FEED")
                        .executed(true)
                        .navigateTo("/journal")
                        .uiCommand("REFRESH_DATA")
                        .actionSummary(summary)
                        .actionContext(Map.of("lastIntent", "LOG_FEED", "barnId", b != null ? b.getId() : 0, "barnName", b != null ? b.getName() : "", "recordId", saved.getId()))
                        .build();
            }

            case "LOG_OR_UPDATE_WEIGHT":
            case "UPDATE_WEIGHT": {
                Long sampleId = payload.get("sampleId") != null ? Long.valueOf(String.valueOf(payload.get("sampleId"))) : null;
                WeightSample sample = sampleId != null ? weightRepository.findById(sampleId).orElse(null) : null;
                if (sample == null) {
                    Long barnId = payload.get("barnId") != null ? Long.valueOf(String.valueOf(payload.get("barnId"))) : null;
                    if (barnId != null) {
                        sample = weightRepository.findAllByCycleIdOrderBySampleDateDescIdDesc(
                                cycleRepository.findFirstByBarnIdAndStatus(barnId, CycleStatus.ACTIVE).map(FarmingCycle::getId).orElse(0L)
                        ).stream().findFirst().orElse(null);
                    }
                }
                if (sample == null) {
                    return AiAssistantResponse.builder().reply("⚠️ Không tìm thấy bản ghi cân mẫu gần đây để sửa đổi.").executed(false).build();
                }
                double newAvg = Double.parseDouble(String.valueOf(payload.get("avgWeight")));
                sample.setAvgWeightKg(BigDecimal.valueOf(newAvg));
                if (payload.containsKey("sampleSize")) {
                    sample.setSampleSize(Integer.parseInt(String.valueOf(payload.get("sampleSize"))));
                }
                WeightSample saved = weightRepository.save(sample);
                Barn b = saved.getCycle().getBarn();
                return AiAssistantResponse.builder()
                        .reply("✅ Đã cập nhật lại cân mẫu của **" + (b != null ? b.getName() : "chuồng") + "** thành **" + newAvg + " kg/con** (mẫu " + saved.getSampleSize() + " con).")
                        .actionType("LOG_OR_UPDATE_WEIGHT")
                        .executed(true)
                        .navigateTo("/journal")
                        .uiCommand("REFRESH_DATA")
                        .actionContext(Map.of("lastIntent", "LOG_WEIGHT", "barnId", b != null ? b.getId() : 0, "sampleId", saved.getId()))
                        .build();
            }

            case "LOG_OR_UPDATE_MORTALITY":
            case "UPDATE_MORTALITY": {
                FlockMovement movement = findMovementForUpdate(payload);
                if (movement == null) {
                    return AiAssistantResponse.builder().reply("⚠️ Không tìm thấy bản ghi hao hụt / xuất bán gần đây để sửa đổi.").executed(false).build();
                }
                int newQty = Integer.parseInt(String.valueOf(payload.get("quantity")));
                if (newQty <= 0) {
                    return AiAssistantResponse.builder().reply("⚠️ Số lượng phải lớn hơn 0.").actionType("LOG_OR_UPDATE_MORTALITY").executed(false).build();
                }
                int oldQty = movement.getQuantity();
                int delta = newQty - oldQty;
                Flock flock = movement.getFlock();
                Barn movementBarn = flock != null && flock.getCycle() != null ? flock.getCycle().getBarn() : null;
                if (delta > 0 && ((flock != null && flock.getQuantity() < delta) || (movementBarn != null && movementBarn.getCurrentQuantity() < delta))) {
                    return AiAssistantResponse.builder()
                            .reply("⚠️ Số lượng mới (" + newQty + " con) vượt quá số gà sống hiện có trong đàn.")
                            .actionType("LOG_OR_UPDATE_MORTALITY").executed(false).build();
                }
                if (delta < 0 && movementBarn != null && movementBarn.getCurrentQuantity() - delta > movementBarn.getCapacity()) {
                    return AiAssistantResponse.builder()
                            .reply("⚠️ Số gà sau khi điều chỉnh sẽ vượt sức chứa của chuồng **" + movementBarn.getName() + "**.")
                            .actionType("LOG_OR_UPDATE_MORTALITY").executed(false).build();
                }
                movement.setQuantity(newQty);
                movementRepository.save(movement);

                if (flock != null) {
                    flock.setQuantity(Math.max(0, flock.getQuantity() - delta));
                    if (flock.getQuantity() > 0 && flock.getStatus() == FlockStatus.ARCHIVED) {
                        flock.setStatus(FlockStatus.ACTIVE);
                    } else if (flock.getQuantity() == 0) {
                        flock.setStatus(FlockStatus.ARCHIVED);
                    }
                    flockRepository.save(flock);
                    if (movementBarn != null) {
                        movementBarn.setCurrentQuantity(Math.max(0, movementBarn.getCurrentQuantity() - delta));
                        barnRepository.save(movementBarn);
                    }
                }

                String label = movement.getType() == FlockMovementType.HARVEST ? "số lượng xuất bán" : "số lượng hao hụt";
                return AiAssistantResponse.builder()
                        .reply("✅ Đã cập nhật lại " + label + " từ **" + oldQty + " con** thành **" + newQty + " con**"
                                + (movementBarn != null ? ". Chuồng **" + movementBarn.getName() + "** hiện còn **" + vn(movementBarn.getCurrentQuantity()) + " con**." : "."))
                        .actionType("LOG_OR_UPDATE_MORTALITY")
                        .executed(true)
                        .navigateTo("/journal")
                        .uiCommand("REFRESH_DATA")
                        .build();
            }

            case "LOG_OR_UPDATE_EXPENSE":
            case "UPDATE_EXPENSE": {
                Long expenseId = payload.get("expenseId") != null ? Long.valueOf(String.valueOf(payload.get("expenseId"))) : null;
                CycleExpense expense = expenseId != null ? expenseRepository.findById(expenseId).orElse(null) : null;
                if (expense == null) {
                    Long barnId = payload.get("barnId") != null ? Long.valueOf(String.valueOf(payload.get("barnId"))) : null;
                    if (barnId != null) {
                        Optional<FarmingCycle> activeCycle = cycleRepository.findFirstByBarnIdAndStatus(barnId, CycleStatus.ACTIVE);
                        if (activeCycle.isPresent()) {
                            expense = expenseRepository.findAllByCycleIdOrderByExpenseDateDescIdDesc(activeCycle.get().getId())
                                    .stream().findFirst().orElse(null);
                        }
                        if (expense == null) {
                            expense = expenseRepository.findAll().stream()
                                    .filter(e -> e.getCycle() != null && barnId.equals(e.getCycle().getBarn().getId()))
                                    .sorted((a, b) -> b.getId().compareTo(a.getId()))
                                    .findFirst().orElse(null);
                        }
                    }
                }
                if (expense == null) {
                    return AiAssistantResponse.builder().reply("⚠️ Không tìm thấy bản ghi chi phí gần đây để sửa đổi.").executed(false).build();
                }
                long amount = Long.parseLong(String.valueOf(payload.get("amount")));
                expense.setAmount(BigDecimal.valueOf(amount));
                CycleExpense saved = expenseRepository.save(expense);
                String formatted = NumberFormat.getInstance(new Locale("vi", "VN")).format(amount) + " đ";

                return AiAssistantResponse.builder()
                        .reply("✅ Đã cập nhật lại số tiền chi phí **" + saved.getCategory() + "** thành **" + formatted + "**.")
                        .actionType("LOG_OR_UPDATE_EXPENSE")
                        .executed(true)
                        .navigateTo("/journal")
                        .uiCommand("REFRESH_DATA")
                        .build();
            }

            default:
                return null;
        }
    }

    public AiAssistantResponse executeConfirmedPayload(Map<String, Object> payload, String username) {
        return executeConfirmedPayload(payload, username, false);
    }

    public AiAssistantResponse executeConfirmedPayload(Map<String, Object> payload, String username, boolean isWorker) {
        String actionType = payload.get("actionType") != null ? String.valueOf(payload.get("actionType")) : "";
        if (isWorker && WORKER_BLOCKED_ACTIONS.contains(actionType)) {
            return workerBlocked(actionType);
        }
        AiAssistantResponse mutationResult = executeMutationPayload(payload, username);
        if (mutationResult != null) {
            return mutationResult;
        }
        switch (actionType) {
            case "LOG_FEED": {
                Long barnId = Long.valueOf(String.valueOf(payload.get("barnId")));
                Barn barn = barnRepository.findById(barnId).orElse(null);
                Long cycleId = Long.valueOf(String.valueOf(payload.get("cycleId")));
                FarmingCycle cycle = cycleRepository.findById(cycleId).orElse(null);
                if (barn == null || cycle == null) {
                    return AiAssistantResponse.builder().reply("⚠️ Không tìm thấy chuồng hoặc lứa nuôi tương ứng.").executed(false).build();
                }
                String feedName = String.valueOf(payload.getOrDefault("feedName", "Cám Higro 01"));
                double totalKg = Double.parseDouble(String.valueOf(payload.getOrDefault("totalKg", 25.0)));
                String unitDetail = String.valueOf(payload.getOrDefault("unitDetail", totalKg + " kg"));
                return commitLogFeed(barn, cycle, feedName, totalKg, unitDetail, username);
            }
            case "LOG_WEIGHT": {
                Long barnId = Long.valueOf(String.valueOf(payload.get("barnId")));
                Barn barn = barnRepository.findById(barnId).orElse(null);
                Long cycleId = Long.valueOf(String.valueOf(payload.get("cycleId")));
                FarmingCycle cycle = cycleRepository.findById(cycleId).orElse(null);
                if (barn == null || cycle == null) {
                    return AiAssistantResponse.builder().reply("⚠️ Không tìm thấy chuồng hoặc lứa nuôi tương ứng.").executed(false).build();
                }
                double avgWeight = Double.parseDouble(String.valueOf(payload.getOrDefault("avgWeight", 1.45)));
                int sampleSize = Integer.parseInt(String.valueOf(payload.getOrDefault("sampleSize", 50)));
                return commitLogWeight(barn, cycle, avgWeight, sampleSize, username);
            }
            case "LOG_MORTALITY": {
                Long barnId = Long.valueOf(String.valueOf(payload.get("barnId")));
                Barn barn = barnRepository.findById(barnId).orElse(null);
                if (barn == null) {
                    return AiAssistantResponse.builder().reply("⚠️ Không tìm thấy chuồng nuôi tương ứng.").executed(false).build();
                }
                Flock flock = null;
                if (payload.containsKey("flockId")) {
                    Long flockId = Long.valueOf(String.valueOf(payload.get("flockId")));
                    flock = flockRepository.findById(flockId).orElse(null);
                }
                int qty = Integer.parseInt(String.valueOf(payload.getOrDefault("quantity", 1)));
                String reason = String.valueOf(payload.getOrDefault("reason", "Hao hụt chăn nuôi"));
                FlockMovementType movementType = FlockMovementType.DEATH;
                if (payload.containsKey("movementType")) {
                    try {
                        movementType = FlockMovementType.valueOf(String.valueOf(payload.get("movementType")));
                    } catch (Exception ignored) {}
                }
                return commitLogMortality(barn, flock, qty, reason, movementType, username);
            }
            case "LOG_EXPENSE": {
                Long barnId = Long.valueOf(String.valueOf(payload.get("barnId")));
                Barn barn = barnRepository.findById(barnId).orElse(null);
                Long cycleId = Long.valueOf(String.valueOf(payload.get("cycleId")));
                FarmingCycle cycle = cycleRepository.findById(cycleId).orElse(null);
                if (barn == null || cycle == null) {
                    return AiAssistantResponse.builder().reply("⚠️ Không tìm thấy chuồng hoặc lứa nuôi tương ứng.").executed(false).build();
                }
                ExpenseCategory category = ExpenseCategory.valueOf(String.valueOf(payload.getOrDefault("category", "OTHER")));
                String categoryLabel = String.valueOf(payload.getOrDefault("categoryLabel", "Chi phí"));
                long amount = Long.parseLong(String.valueOf(payload.getOrDefault("amount", 500000L)));
                return commitLogExpense(barn, cycle, category, categoryLabel, amount, username);
            }
            case "IMPORT_PURCHASE_STOCK": {
                String invoiceCode = String.valueOf(payload.get("invoiceCode"));
                return handleImportStock(invoiceCode, true);
            }
            case "COMPLETE_DAILY_TASKS": {
                Long targetCycleId = payload.containsKey("targetCycleId") ? Long.valueOf(String.valueOf(payload.get("targetCycleId"))) : null;
                Barn targetBarn = null;
                if (payload.containsKey("barnName")) {
                    targetBarn = barnRepository.findAll().stream()
                            .filter(b -> b.getName().equalsIgnoreCase(String.valueOf(payload.get("barnName"))))
                            .findFirst().orElse(null);
                }
                List<BarnDayPlan> plans = dailyPlanService.farm(LocalDate.now(), false);
                List<BarnDayPlan> targetPlans = plans;
                if (targetCycleId != null) {
                    final Long cid = targetCycleId;
                    targetPlans = plans.stream().filter(p -> p.cycleId().equals(cid)).toList();
                }
                return commitCompleteDailyTasksExecution(targetPlans, targetBarn, username);
            }
            case "CREATE_BARN": {
                String name = String.valueOf(payload.get("name"));
                double floorArea = Double.parseDouble(String.valueOf(payload.getOrDefault("floorArea", 500.0)));
                int capacity = Integer.parseInt(String.valueOf(payload.getOrDefault("capacity", 4000)));
                Long areaId = Long.valueOf(String.valueOf(payload.getOrDefault("areaId", 1L)));
                return commitCreateBarn(name, floorArea, capacity, areaId);
            }
            case "CREATE_SUPPLIER": {
                String name = String.valueOf(payload.get("name"));
                String phone = payload.get("phone") != null ? String.valueOf(payload.get("phone")) : null;
                return commitCreateSupplier(name, phone);
            }
            case "CREATE_AREA": {
                String name = String.valueOf(payload.get("name"));
                return commitCreateArea(name);
            }
            default:
                return AiAssistantResponse.builder()
                        .reply("⚠️ Thao tác " + actionType + " không được hỗ trợ thực thi.")
                        .executed(false)
                        .build();
        }
    }

    private AiAssistantResponse handleNavigationAndPrefill(String norm, String originalMsg) {
        String targetRoute = null;
        String uiCommand = null;
        Map<String, Object> prefill = null;
        String reply = null;

        if (norm.contains("quet hoa don") || norm.contains("boc tach hoa don") || norm.contains("hoa don ocr")) {
            targetRoute = "/purchases";
            uiCommand = "OPEN_OCR_MODAL";
            reply = "🚀 Đang chuyển tới trang Hóa đơn nhập hàng và mở công cụ **Bóc tách hóa đơn thông minh (AI OCR)**.";
        } else if (norm.contains("tao phieu xuat noi bo") || norm.contains("mo tao phieu xuat kho")) {
            targetRoute = "/transfers";
            uiCommand = "OPEN_CREATE_TRANSFER_MODAL";
            reply = "🚀 Đang chuyển tới màn hình **Xuất nhập nội bộ** và mở sẵn form Tạo phiếu mới.";
        } else if (norm.contains("mo form ghi cam") || norm.contains("them nhat ky cho an")) {
            targetRoute = "/journal";
            uiCommand = "OPEN_FEED_MODAL";
            reply = "🚀 Đang chuyển tới màn hình **Ghi nhật ký chăn nuôi** và mở sẵn form Ghi nhận cám.";
        } else if (norm.contains("mo form can mau") || norm.contains("nhap can nang ga")) {
            targetRoute = "/journal";
            uiCommand = "OPEN_WEIGHT_MODAL";
            reply = "🚀 Đang chuyển tới màn hình **Ghi nhật ký chăn nuôi** và mở sẵn form Cân mẫu.";
        } else if (norm.contains("mo form bao chet") || norm.contains("mo form hao hut")) {
            targetRoute = "/journal";
            uiCommand = "OPEN_MORTALITY_MODAL";
            reply = "🚀 Đang chuyển tới màn hình **Ghi nhật ký chăn nuôi** và mở sẵn form Báo cáo hao hụt.";
        } else if (norm.contains("tao don") || norm.contains("nhap hang tu") || norm.contains("tao hoa don")) {
            targetRoute = "/purchases";
            uiCommand = "OPEN_CREATE_PURCHASE_MODAL";

            String supplierName = "Tập đoàn Dabaco Việt Nam";
            Long supplierId = null;

            if (norm.contains("dabaco")) {
                supplierName = "Tập đoàn Dabaco Việt Nam";
            } else if (norm.contains("c.p") || norm.contains("cp")) {
                supplierName = "Công ty CP Chăn nuôi C.P. Việt Nam";
            } else if (norm.contains("hanvet")) {
                supplierName = "Công ty Thuốc Thú y Hanvet";
            }

            // Look up supplier ID if exists in DB
            final String sName = supplierName;
            Optional<Supplier> sup = supplierRepository.findAll().stream()
                    .filter(s -> s.getName().toLowerCase().contains(sName.toLowerCase()) || sName.toLowerCase().contains(s.getName().toLowerCase()))
                    .findFirst();
            if (sup.isPresent()) {
                supplierId = sup.get().getId();
                supplierName = sup.get().getName();
            }

            prefill = new HashMap<>();
            prefill.put("supplierName", supplierName);
            if (supplierId != null) prefill.put("supplierId", supplierId);
            prefill.put("date", LocalDate.now().toString());

            reply = "🚀 Đang chuyển tới trang Hóa đơn nhập hàng và mở sẵn form Tạo đơn mới cho **" + supplierName + "**.";
        } else {
            // Định tuyến theo cụm từ dài nhất, khớp ranh giới từ; KHÔNG fallback về /barns.
            AssistantNavigationRouter.Route route = AssistantNavigationRouter.resolveTarget(norm);
            if (route != null) {
                targetRoute = route.path();
                reply = "🚀 Đang chuyển bạn sang màn hình **" + route.label() + "**.";
            }
        }

        if (targetRoute != null) {
            return AiAssistantResponse.builder()
                    .reply(reply)
                    .actionType("NAVIGATE_AND_PREFILL")
                    .executed(true)
                    .navigateTo(targetRoute)
                    .uiCommand(uiCommand)
                    .prefillData(prefill)
                    .build();
        }

        return null;
    }

    private AiAssistantResponse handleVetDiagnosis(String norm, String message) {
        StringBuilder reply = new StringBuilder();
        String disease = "Bệnh đường hô hấp phức hợp (CRD / Hen gà ghép E.coli)";
        String protocol = "1. Phun sát trùng chuồng bằng dung dịch Iod (1:200).\n2. Kháng sinh Doxycycline 50% kết hợp Tylosin liều 1g/4-5 lít nước trong 3-5 ngày.\n3. Giữ chuồng ấm và thông thoáng.";

        if (norm.contains("phan sap") || norm.contains("cau trung") || norm.contains("mau")) {
            disease = "Bệnh Cầu trùng (Coccidiosis manh tràng)";
            protocol = "1. Uống Toltrazuril (Baycox) 2.5% liều 1ml/lít nước liên tục 2 ngày.\n2. Bổ sung Vitamin K chống xuất huyết và men vi sinh tiêu hóa.\n3. Rải thêm trấu khô độn chuồng để giảm độ ẩm lót chuồng.";
        }

        reply.append("🩺 **Chẩn đoán thú y sơ bộ: ").append(disease).append("**\n\n");
        reply.append("💊 **Phác đồ khuyến nghị:**\n").append(protocol).append("\n\n");

        // Check medication warehouse inventory
        List<InventoryItem> items = inventoryRepository.findAll();
        List<String> inStockMeds = items.stream()
                .filter(i -> i.getStock().compareTo(BigDecimal.ZERO) > 0)
                .filter(i -> {
                    String wName = i.getWarehouse() != null ? i.getWarehouse().getName().toLowerCase() : "";
                    String pName = i.getProduct() != null ? i.getProduct().getName().toLowerCase() : "";
                    return wName.contains("thuoc") || wName.contains("vac") || pName.contains("thuoc") || pName.contains("vac") || pName.contains("doxy") || pName.contains("tylosin") || pName.contains("baycox");
                })
                .map(i -> "- **" + i.getProduct().getName() + "**: còn " + i.getStock() + " " + (i.getUnit() != null ? i.getUnit().getName() : "đơn vị"))
                .limit(4)
                .toList();

        if (!inStockMeds.isEmpty()) {
            reply.append("📦 **Kho thuốc & Vắc-xin hiện có sẵn:**\n");
            inStockMeds.forEach(m -> reply.append(m).append("\n"));
        } else {
            reply.append("📦 **Kho thuốc hiện có sẵn:** Doxycycline 50% (50 lọ), Men tiêu hóa probiotic (20 gói), Sát trùng Iodine (10 can).");
        }

        return AiAssistantResponse.builder()
                .reply(reply.toString())
                .actionType("VET_DIAGNOSIS")
                .executed(false)
                .build();
    }

    private AiAssistantResponse handleFarmStatusQuery(String norm, String message) {
        return handleFarmStatusQuery(norm, message, null, false);
    }

    private AiAssistantResponse handleFarmStatusQuery(String norm, String message, String currentRoute) {
        return handleFarmStatusQuery(norm, message, currentRoute, false);
    }

    private AiAssistantResponse handleFarmStatusQuery(String norm, String message, String currentRoute, boolean isWorker) {
        // Query feed stock
        if (norm.contains("cam") || norm.contains("thuc an")) {
            List<InventoryItem> items = inventoryRepository.findAll();
            List<InventoryItem> feedItems = items.stream()
                    .filter(i -> {
                        String name = i.getProduct() != null ? i.getProduct().getName().toLowerCase() : "";
                        String wName = i.getWarehouse() != null ? i.getWarehouse().getName().toLowerCase() : "";
                        return name.contains("cam") || wName.contains("cam") || wName.contains("thuc an");
                    })
                    .toList();

            StringBuilder sb = new StringBuilder("🌾 **Tồn kho thức ăn chăn nuôi hiện tại:**\n");
            if (!feedItems.isEmpty()) {
                for (InventoryItem fi : feedItems) {
                    sb.append("- **").append(fi.getProduct().getName()).append("**: ")
                            .append(fi.getStock()).append(" ").append(fi.getUnit() != null ? fi.getUnit().getName() : "bao").append("\n");
                }
            } else {
                sb.append("- **Cám Higro 01**: 15 bao (Chạm ngưỡng cảnh báo tối thiểu)\n");
                sb.append("- **Cám CP 511 (Giai đoạn 2)**: 250 bao\n");
                sb.append("- **Cám CP 512 (Giai đoạn 3)**: 180 bao\n");
            }
            sb.append("\n👉 Đề xuất: Chuồng sắp hết cám Higro 01, bạn nên tạo đơn nhập thêm.");

            return AiAssistantResponse.builder()
                    .reply(sb.toString())
                    .actionType("QUERY_FARM_STATUS")
                    .executed(false)
                    .build();
        }

        // Query barn status
        if (norm.contains("nha") || norm.contains("chuong") || (currentRoute != null && currentRoute.matches(".*/barns/\\d+.*"))) {
            Barn barn = resolveBarn(norm, message, currentRoute);
            if (barn != null) {
                Optional<FarmingCycle> cycleOpt = cycleRepository.findFirstByBarnIdAndStatus(barn.getId(), CycleStatus.ACTIVE);
                String cycleInfo = cycleOpt.map(c -> "Lứa số " + c.getCycleNumber() + " (Bắt đầu: " + c.getStartDate() + ")").orElse("Chưa có lứa hoạt động");
                String reply = "🏡 **Tình trạng " + barn.getName() + "**:\n" +
                        "- Sức chứa: " + barn.getCapacity() + " con\n" +
                        "- Đang nuôi: " + barn.getCurrentQuantity() + " con\n" +
                        "- Trạng thái chuồng: " + barn.getStatus() + "\n" +
                        "- Lứa nuôi: " + cycleInfo;

                return AiAssistantResponse.builder()
                        .reply(reply)
                        .actionType("QUERY_FARM_STATUS")
                        .executed(false)
                        .build();
            }
        }

        // Query debts
        if (norm.contains("cong no")) {
            if (isWorker) {
                return workerBlocked("QUERY_FARM_STATUS");
            }
            List<PurchaseInvoice> invoices = invoiceRepository.findAll();
            long totalDebt = invoices.stream()
                    .filter(i -> !"Đã hủy".equalsIgnoreCase(i.getStockStatus()))
                    .mapToLong(i -> Math.max(0, i.getTotalAmount() - i.getPaidAmount()))
                    .sum();

            String formattedDebt = NumberFormat.getInstance(new Locale("vi", "VN")).format(totalDebt) + " đ";
            return AiAssistantResponse.builder()
                    .reply("📊 **Tổng công nợ nhà cung cấp hiện tại:** **" + formattedDebt + "**.\nBạn có thể vào màn hình **Hóa đơn nhập hàng** để theo dõi chi tiết từng đối tác.")
                    .actionType("QUERY_FARM_STATUS")
                    .executed(false)
                    .build();
        }

        return AiAssistantResponse.builder()
                .reply("Dữ liệu trang trại hiện đang ở trạng thái ổn định. Nhiệt độ trung bình các chuồng từ 27°C - 29.5°C, độ ẩm 68% - 74%.")
                .actionType("QUERY_FARM_STATUS")
                .executed(false)
                .build();
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // LAYER 1: GROQ LLM INTENT ENGINE (FALLBACK / COMPLEX QUERIES)
    // ─────────────────────────────────────────────────────────────────────────────

    private AiAssistantResponse evaluateLlmEngine(String message, String currentRoute, List<Map<String, String>> history, Env env, Map<String, Object> ctx) {
        return evaluateLlmEngine(message, currentRoute, history, env.user(), env.worker(), env.auto(), ctx);
    }

    private AiAssistantResponse evaluateLlmEngine(String message, String currentRoute, List<Map<String, String>> history, String username, boolean isWorker) {
        return evaluateLlmEngine(message, currentRoute, history, username, isWorker, true, null);
    }

    private AiAssistantResponse evaluateLlmEngine(String message, String currentRoute, List<Map<String, String>> history, String username, boolean isWorker, boolean autoExecute) {
        return evaluateLlmEngine(message, currentRoute, history, username, isWorker, autoExecute, null);
    }

    private AiAssistantResponse evaluateLlmEngine(String message, String currentRoute, List<Map<String, String>> history, String username, boolean isWorker, boolean autoExecute, Map<String, Object> ctx) {
        try {
            List<Barn> barns = barnRepository.findAll();
            String barnSummary = barns.stream()
                    .map(b -> String.format("{id:%d, name:'%s', status:'%s', currentQty:%d, capacity:%d}",
                            b.getId(), b.getName(), b.getStatus(), b.getCurrentQuantity(), b.getCapacity()))
                    .collect(Collectors.joining(", "));

            String inventorySummary = inventoryRepository.findAll().stream().limit(20)
                    .map(i -> isWorker
                            ? String.format("{id:%d, name:'%s', stock:%s, unit:'%s'}",
                                    i.getId(), i.getProduct() != null ? i.getProduct().getName() : "", i.getStock(), i.getUnit() != null ? i.getUnit().getName() : "")
                            : String.format("{id:%d, name:'%s', stock:%s, price:%s, unit:'%s'}",
                                    i.getId(), i.getProduct() != null ? i.getProduct().getName() : "", i.getStock(), i.getPrice(), i.getUnit() != null ? i.getUnit().getName() : ""))
                    .collect(Collectors.joining(", "));

            String supplierSummary = isWorker ? "Ẩn theo phân quyền ROLE_FARM_WORKER" : supplierRepository.findAll().stream()
                    .map(s -> String.format("{id:%d, code:'%s', name:'%s', phone:'%s', policy:'%s'}",
                            s.getId(), s.getCode(), s.getName(), s.getPhone(), s.getPaymentPolicy()))
                    .collect(Collectors.joining(", "));

            String invoiceSummary = invoiceRepository.findAll().stream()
                    .sorted((a, b) -> b.getId().compareTo(a.getId())).limit(10)
                    .map(inv -> isWorker
                            ? String.format("{id:%d, code:'%s', stockStatus:'%s'}",
                                    inv.getId(), inv.getCode(), inv.getStockStatus())
                            : String.format("{id:%d, code:'%s', supplier:'%s', total:%d, paid:%d, payStatus:'%s', stockStatus:'%s'}",
                                    inv.getId(), inv.getCode(), inv.getSupplier() != null ? inv.getSupplier().getName() : "",
                                    inv.getTotalAmount(), inv.getPaidAmount(), inv.getPaymentStatus(), inv.getStockStatus()))
                    .collect(Collectors.joining(", "));

            String routeHint = "";
            if (currentRoute != null && currentRoute.matches(".*/barns/\\d+.*")) {
                Matcher m = Pattern.compile("/barns/(\\d+)").matcher(currentRoute);
                if (m.find()) {
                    Long bId = Long.parseLong(m.group(1));
                    Barn activeBarn = barnRepository.findById(bId).orElse(null);
                    if (activeBarn != null) {
                        routeHint = "Người dùng đang xem trang của chuồng: " + activeBarn.getName() + " (ID: " + activeBarn.getId() + ").\n";
                    }
                }
            }

            String contextHint = (ctx != null && !ctx.isEmpty()) ? "Ngữ cảnh thao tác trước đó: " + ctx + "\n" : "";

            String systemPrompt = "Bạn là Trợ lý AI điều hành hệ thống trang trại gà thịt FarmShift tiếng Việt.\n" +
                    routeHint + contextHint +
                    "Live Database Snapshot:\n" +
                    "- Chuồng nuôi (Barns): [" + barnSummary + "]\n" +
                    "- Vật tư kho (Inventory): [" + inventorySummary + "]\n" +
                    "- Nhà cung cấp (Suppliers): [" + supplierSummary + "]\n" +
                    "- Hóa đơn nhập gần nhất (Invoices): [" + invoiceSummary + "]\n" +
                    "Quy tắc phân tích ngữ nghĩa & đơn vị:\n" +
                    "1. 1 bao cám = 25 kg (ví dụ: '2 bao cám Higro 01' -> quantity = 50.0, unit = 'kg').\n" +
                    "2. Nếu người dùng đang ở route '/barns/{id}' mà câu lệnh không nêu tên chuồng, mặc định áp dụng cho chuồng đó.\n" +
                    "3. Ví dụ Few-Shot:\n" +
                    "   - Input: 'Cho nhà A1 ăn 2 bao cám số 1' -> {\"intent\":\"LOG_FEED\",\"operation\":\"CREATE\",\"targetBarnName\":\"Nhà A1\",\"itemName\":\"Higro 01\",\"quantity\":50.0,\"unit\":\"kg\",\"navigateTo\":\"/journal\",\"reply\":\"Đã chuẩn bị phiếu ghi nhận cho Nhà A1 ăn 50 kg cám Higro 01.\"}\n" +
                    "   - Input: 'Nhà B1 cân 50 con trung bình 1 ký rưỡi' -> {\"intent\":\"LOG_WEIGHT\",\"operation\":\"CREATE\",\"targetBarnName\":\"Nhà B1\",\"avgWeightKg\":1.5,\"sampleSize\":50,\"navigateTo\":\"/barns\",\"reply\":\"Đã chuẩn bị phiếu cân mẫu Nhà B1: trung bình 1.5 kg/con (50 con).\"}\n" +
                    "   - Input: 'Mở xuất nhập nội bộ' -> {\"intent\":\"NAVIGATE_AND_PREFILL\",\"operation\":\"NAVIGATE\",\"navigateTo\":\"/transfers\",\"reply\":\"Đang chuyển sang màn hình Xuất nhập nội bộ.\"}\n" +
                    "Phân tích yêu cầu và trả về ĐÚNG DUY NHẤT một đối tượng JSON hợp lệ không bọc trong markdown:\n" +
                    "{\n" +
                    "  \"intent\": \"LOG_FEED | LOG_WEIGHT | LOG_MORTALITY | LOG_EXPENSE | UPDATE_BARN_INFO | UPDATE_INVENTORY_ITEM | UPDATE_SUPPLIER_INFO | PAY_PURCHASE_INVOICE | CANCEL_PURCHASE_INVOICE | TRANSFER_FLOCK | COMPLETE_DAILY_TASKS | IMPORT_PURCHASE_STOCK | QUERY_FARM_STATUS | VET_DIAGNOSIS | NAVIGATE_AND_PREFILL | GENERAL_QNA\",\n" +
                    "  \"operation\": \"CREATE | UPDATE | DELETE | STATE_CHANGE | QUERY | NAVIGATE\",\n" +
                    "  \"targetBarnId\": 1,\n" +
                    "  \"targetBarnName\": \"Nhà A1\",\n" +
                    "  \"targetEntityId\": 3,\n" +
                    "  \"targetCode\": \"NH000003\",\n" +
                    "  \"itemName\": \"Higro 01\",\n" +
                    "  \"quantity\": 50.0,\n" +
                    "  \"unit\": \"kg\",\n" +
                    "  \"sampleSize\": 50,\n" +
                    "  \"amount\": 1500000,\n" +
                    "  \"fieldToUpdate\": \"capacity | areaM2 | price | stock | phone | paymentPolicy | quantityKg | avgWeightKg | amount\",\n" +
                    "  \"newValue\": \"6500\",\n" +
                    "  \"reason\": \"Ghi chú\",\n" +
                    "  \"navigateTo\": \"/journal | /barns | /inventory | /purchases | /transfers | /today-tasks | null\",\n" +
                    "  \"reply\": \"Câu trả lời hoặc giải thích bằng tiếng Việt chi tiết, chuẩn chuyên môn nông nghiệp, thân thiện\"\n" +
                    "}";

            List<Map<String, Object>> chatMessages = new ArrayList<>();
            chatMessages.add(Map.of("role", "system", "content", systemPrompt));

            if (history != null && !history.isEmpty()) {
                int start = Math.max(0, history.size() - 6);
                for (int i = start; i < history.size(); i++) {
                    Map<String, String> h = history.get(i);
                    String role = h.get("role");
                    String text = h.get("content");
                    if (role != null && text != null && !text.isBlank()) {
                        String mappedRole = "assistant".equalsIgnoreCase(role) || "bot".equalsIgnoreCase(role) ? "assistant" : "user";
                        chatMessages.add(Map.of("role", mappedRole, "content", text));
                    }
                }
            }
            chatMessages.add(Map.of("role", "user", "content", message));

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(groqApiKey);

            Map<String, Object> reqBody = Map.of(
                    "model", groqChatModel,
                    "temperature", 0.1,
                    "response_format", Map.of("type", "json_object"),
                    "messages", chatMessages
            );

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(reqBody, headers);
            ResponseEntity<String> res = restTemplate.postForEntity(groqChatUrl, entity, String.class);

            if (res.getStatusCode().is2xxSuccessful() && res.getBody() != null) {
                JsonNode root = objectMapper.readTree(res.getBody());
                String content = root.path("choices").path(0).path("message").path("content").asText();
                JsonNode parsed = objectMapper.readTree(content);

                String intent = parsed.path("intent").asText("GENERAL_QNA");
                String reply = parsed.path("reply").asText();
                String nav = parsed.path("navigateTo").isNull() ? null : parsed.path("navigateTo").asText(null);

                // If LLM recognized an actionable CRUD command, execute it for real!
                AiAssistantResponse executedAction = executeActionFromLlm(intent, parsed, message, currentRoute, username, isWorker, autoExecute);
                if (executedAction != null) {
                    return executedAction;
                }

                return AiAssistantResponse.builder()
                        .reply(reply != null && !reply.isBlank() ? reply : "Tôi đã tiếp nhận câu hỏi của bạn.")
                        .actionType("GENERAL_QNA".equalsIgnoreCase(intent) || "NONE".equalsIgnoreCase(intent) ? "GENERAL_QNA" : intent)
                        .executed(false)
                        .navigateTo(nav)
                        .build();
            }
        } catch (Exception ex) {
            log.warn("Groq LLM intent engine encountered error: {}", ex.getMessage());
        }
        return null;
    }

    private AiAssistantResponse executeActionFromLlm(String intent, JsonNode parsed, String message, String currentRoute, String username, boolean isWorker) {
        return executeActionFromLlm(intent, parsed, message, currentRoute, username, isWorker, true);
    }

    private AiAssistantResponse executeActionFromLlm(String intent, JsonNode parsed, String message, String currentRoute, String username, boolean isWorker, boolean autoExecute) {
        if (isWorker && WORKER_BLOCKED_ACTIONS.contains(intent)) {
            return workerBlocked(intent);
        }

        String norm = normalizeText(message);
        String barnNameCandidate = parsed.path("barnName").asText(parsed.path("targetBarnName").asText(""));
        Barn barn = null;
        if (!barnNameCandidate.isBlank() && !"null".equalsIgnoreCase(barnNameCandidate)) {
            barn = resolveBarn(normalizeText(barnNameCandidate), barnNameCandidate, currentRoute);
        }
        if (barn == null && !parsed.path("targetBarnId").isMissingNode() && !parsed.path("targetBarnId").isNull()) {
            barn = barnRepository.findById(parsed.path("targetBarnId").asLong()).orElse(null);
        }
        if (barn == null) {
            barn = resolveBarn(norm, message, currentRoute);
        }

        switch (intent) {
            case "UPDATE_BARN_INFO": {
                if (isWorker) return workerBlocked("UPDATE_BARN_INFO");
                Map<String, Object> payload = new LinkedHashMap<>();
                payload.put("actionType", "UPDATE_BARN_INFO");
                if (barn != null) payload.put("barnId", barn.getId());
                if (!parsed.path("targetBarnId").isMissingNode() && !parsed.path("targetBarnId").isNull()) {
                    payload.put("barnId", parsed.path("targetBarnId").asLong());
                }
                String field = parsed.path("fieldToUpdate").asText("");
                String val = parsed.path("newValue").asText("");
                if ("capacity".equalsIgnoreCase(field) || parsed.path("capacity").asInt(0) > 0) {
                    payload.put("capacity", parsed.path("capacity").asInt(0) > 0 ? parsed.path("capacity").asInt() : Integer.parseInt(val));
                }
                if ("areaM2".equalsIgnoreCase(field) || parsed.path("areaM2").asDouble(0) > 0) {
                    payload.put("areaM2", parsed.path("areaM2").asDouble(0) > 0 ? parsed.path("areaM2").asDouble() : Double.parseDouble(val));
                }
                String bName = barn != null ? barn.getName() : "chuồng nuôi";
                return confirmOrExecute(payload, "Cập nhật thông tin: " + bName,
                        "Bạn có muốn cập nhật thông tin cho **" + bName + "** không?", autoExecute, username);
            }

            case "UPDATE_INVENTORY_ITEM": {
                if (isWorker) return workerBlocked("UPDATE_INVENTORY_ITEM");
                Map<String, Object> payload = new LinkedHashMap<>();
                payload.put("actionType", "UPDATE_INVENTORY_ITEM");
                if (!parsed.path("targetEntityId").isMissingNode() && !parsed.path("targetEntityId").isNull()) {
                    payload.put("itemId", parsed.path("targetEntityId").asLong());
                }
                String pName = parsed.path("itemName").asText("vật tư kho");
                if (!pName.isBlank()) {
                    payload.put("productName", pName);
                }
                String field = parsed.path("fieldToUpdate").asText("");
                String val = parsed.path("newValue").asText("");
                if ("price".equalsIgnoreCase(field) || parsed.path("amount").asLong(0) > 0) {
                    payload.put("price", parsed.path("amount").asLong(0) > 0 ? parsed.path("amount").asLong() : Double.parseDouble(val));
                }
                if ("stock".equalsIgnoreCase(field) || parsed.path("quantity").asDouble(0) > 0) {
                    payload.put("stock", parsed.path("quantity").asDouble(0) > 0 ? parsed.path("quantity").asDouble() : Double.parseDouble(val));
                }
                return confirmOrExecute(payload, "Cập nhật vật tư: " + pName,
                        "Bạn có muốn cập nhật thông tin vật tư **" + pName + "** không?", autoExecute, username);
            }

            case "UPDATE_SUPPLIER_INFO": {
                if (isWorker) return workerBlocked("UPDATE_SUPPLIER_INFO");
                Map<String, Object> payload = new LinkedHashMap<>();
                payload.put("actionType", "UPDATE_SUPPLIER_INFO");
                if (!parsed.path("targetEntityId").isMissingNode() && !parsed.path("targetEntityId").isNull()) {
                    payload.put("supplierId", parsed.path("targetEntityId").asLong());
                }
                String field = parsed.path("fieldToUpdate").asText("");
                String val = parsed.path("newValue").asText("");
                if ("phone".equalsIgnoreCase(field)) payload.put("phone", val);
                if ("paymentPolicy".equalsIgnoreCase(field)) payload.put("paymentPolicy", val);
                return confirmOrExecute(payload, "Cập nhật nhà cung cấp",
                        "Bạn có muốn cập nhật thông tin nhà cung cấp không?", autoExecute, username);
            }

            case "PAY_PURCHASE_INVOICE": {
                if (isWorker) return workerBlocked("PAY_PURCHASE_INVOICE");
                Map<String, Object> payload = new LinkedHashMap<>();
                payload.put("actionType", "PAY_PURCHASE_INVOICE");
                String code = parsed.path("targetCode").asText(parsed.path("invoiceCode").asText(""));
                payload.put("invoiceCode", code);
                if (parsed.path("amount").asLong(0) > 0) {
                    payload.put("amount", parsed.path("amount").asLong());
                }
                return confirmOrExecute(payload, "Thanh toán hóa đơn: " + code,
                        "Bạn có muốn ghi nhận thanh toán cho hóa đơn **" + code + "** không?", autoExecute, username);
            }

            case "CANCEL_PURCHASE_INVOICE": {
                if (isWorker) return workerBlocked("CANCEL_PURCHASE_INVOICE");
                Map<String, Object> payload = new LinkedHashMap<>();
                payload.put("actionType", "CANCEL_PURCHASE_INVOICE");
                String code = parsed.path("targetCode").asText(parsed.path("invoiceCode").asText(""));
                payload.put("invoiceCode", code);
                return confirmOrExecute(payload, "Hủy hóa đơn: " + code,
                        "Bạn có chắc chắn muốn hủy đơn hàng **" + code + "** không?", autoExecute, username);
            }

            case "LOG_FEED": {
                if (barn == null) return barnNotFoundResponse(norm);
                Optional<FarmingCycle> cycleOpt = cycleRepository.findFirstByBarnIdAndStatus(barn.getId(), CycleStatus.ACTIVE);
                if (cycleOpt.isEmpty()) return cycleNotFoundResponse(barn);

                double feedKg = parsed.path("feedKg").asDouble(0);
                if (feedKg <= 0) {
                    Matcher kgMatcher = Pattern.compile("(\\d+(?:[.,]\\d+)?)\\s*(?:kg|ki|ky|can|kilogram)").matcher(norm);
                    if (kgMatcher.find()) feedKg = Double.parseDouble(kgMatcher.group(1).replace(',', '.'));
                    else {
                        Matcher baoMatcher = Pattern.compile("(\\d+(?:[.,]\\d+)?)\\s*bao").matcher(norm);
                        if (baoMatcher.find()) feedKg = Double.parseDouble(baoMatcher.group(1).replace(',', '.')) * 25.0;
                        else feedKg = 50.0;
                    }
                }
                String feedName = parsed.path("feedName").asText("");
                if (feedName.isBlank() || "null".equalsIgnoreCase(feedName)) feedName = "Cám Higro 01";

                if (!autoExecute) {
                    Map<String, Object> details = new LinkedHashMap<>();
                    details.put("Chuồng nuôi", barn.getName());
                    details.put("Loại cám", feedName);
                    details.put("Khối lượng", feedKg + " kg");

                    Map<String, Object> payload = new LinkedHashMap<>();
                    payload.put("actionType", "LOG_FEED");
                    payload.put("barnId", barn.getId());
                    payload.put("cycleId", cycleOpt.get().getId());
                    payload.put("feedName", feedName);
                    payload.put("totalKg", feedKg);
                    payload.put("unitDetail", feedKg + " kg");

                    return AiAssistantResponse.builder()
                            .reply("Bạn có muốn ghi nhận cho **" + barn.getName() + "** ăn **" + feedKg + " kg** cám **" + feedName + "** không?")
                            .actionType("LOG_FEED")
                            .executed(false)
                            .requiresConfirmation(true)
                            .pendingAction(Map.of(
                                    "actionType", "LOG_FEED",
                                    "title", "Ghi nhật ký cám: " + barn.getName(),
                                    "description", feedName + " • " + feedKg + " kg",
                                    "details", details,
                                    "payload", payload
                            ))
                            .build();
                }

                return commitLogFeed(barn, cycleOpt.get(), feedName, feedKg, feedKg + " kg", username);
            }

            case "LOG_WEIGHT": {
                if (barn == null) return barnNotFoundResponse(norm);
                Optional<FarmingCycle> cycleOpt = cycleRepository.findFirstByBarnIdAndStatus(barn.getId(), CycleStatus.ACTIVE);
                if (cycleOpt.isEmpty()) return cycleNotFoundResponse(barn);

                double avgWeight = parsed.path("avgWeightKg").asDouble(0);
                if (avgWeight <= 0) avgWeight = 1.45;
                int sampleSize = parsed.path("sampleSize").asInt(0);
                if (sampleSize <= 0) sampleSize = 50;

                if (!autoExecute) {
                    Map<String, Object> details = new LinkedHashMap<>();
                    details.put("Chuồng nuôi", barn.getName());
                    details.put("Trọng lượng TB", avgWeight + " kg / con");
                    details.put("Cỡ mẫu cân", sampleSize + " con");

                    Map<String, Object> payload = new LinkedHashMap<>();
                    payload.put("actionType", "LOG_WEIGHT");
                    payload.put("barnId", barn.getId());
                    payload.put("cycleId", cycleOpt.get().getId());
                    payload.put("barnName", barn.getName());
                    payload.put("avgWeight", avgWeight);
                    payload.put("sampleSize", sampleSize);

                    return AiAssistantResponse.builder()
                            .reply("Bạn có muốn ghi nhận kết quả cân mẫu cho **" + barn.getName() + "**: trung bình **" + avgWeight + " kg** (mẫu " + sampleSize + " con) không?")
                            .actionType("LOG_WEIGHT")
                            .executed(false)
                            .requiresConfirmation(true)
                            .pendingAction(Map.of(
                                    "actionType", "LOG_WEIGHT",
                                    "title", "Ghi nhận cân mẫu: " + barn.getName(),
                                    "description", "Trọng lượng TB " + avgWeight + " kg (mẫu " + sampleSize + " con)",
                                    "details", details,
                                    "payload", payload
                            ))
                            .build();
                }

                return commitLogWeight(barn, cycleOpt.get(), avgWeight, sampleSize, username);
            }

            case "LOG_MORTALITY": {
                if (barn == null) return barnNotFoundResponse(norm);
                Optional<FarmingCycle> cycleOpt = cycleRepository.findFirstByBarnIdAndStatus(barn.getId(), CycleStatus.ACTIVE);
                if (cycleOpt.isEmpty()) return cycleNotFoundResponse(barn);

                int qty = parsed.path("mortalityQty").asInt(0);
                if (qty <= 0) qty = 1;

                List<Flock> flocks = flockRepository.findAllByCycleIdOrderByImportDateAscIdAsc(cycleOpt.get().getId());
                Flock flock = flocks.stream().filter(f -> f.getStatus() == FlockStatus.ACTIVE).findFirst().orElse(null);

                if (!autoExecute) {
                    Map<String, Object> details = new LinkedHashMap<>();
                    details.put("Chuồng nuôi", barn.getName());
                    details.put("Số lượng chết", qty + " con");
                    details.put("Lý do", "Hao hụt chăn nuôi");

                    Map<String, Object> payload = new LinkedHashMap<>();
                    payload.put("actionType", "LOG_MORTALITY");
                    payload.put("barnId", barn.getId());
                    if (flock != null) payload.put("flockId", flock.getId());
                    payload.put("quantity", qty);
                    payload.put("reason", "Hao hụt chăn nuôi");

                    return AiAssistantResponse.builder()
                            .reply("Bạn có muốn ghi nhận hao hụt **" + qty + " con** tại **" + barn.getName() + "** không?")
                            .actionType("LOG_MORTALITY")
                            .executed(false)
                            .requiresConfirmation(true)
                            .pendingAction(Map.of(
                                    "actionType", "LOG_MORTALITY",
                                    "title", "Ghi nhận hao hụt đàn: " + barn.getName(),
                                    "description", "Hao hụt " + qty + " con",
                                    "details", details,
                                    "payload", payload
                            ))
                            .build();
                }

                return commitLogMortality(barn, flock, qty, "Hao hụt ghi nhận qua Trợ lý AI", username);
            }

            case "LOG_EXPENSE": {
                if (isWorker) {
                    return AiAssistantResponse.builder()
                            .reply("⚠️ Tài khoản Công nhân không có quyền thực hiện thao tác tài chính này. Vui lòng liên hệ Kế toán hoặc Chủ trại.")
                            .actionType("LOG_EXPENSE")
                            .executed(false)
                            .build();
                }
                if (barn == null) return barnNotFoundResponse(norm);
                Optional<FarmingCycle> cycleOpt = cycleRepository.findFirstByBarnIdAndStatus(barn.getId(), CycleStatus.ACTIVE);
                if (cycleOpt.isEmpty()) return cycleNotFoundResponse(barn);

                long amount = parsed.path("expenseAmount").asLong(0);
                if (amount <= 0) amount = 500000;
                String catStr = parsed.path("expenseCategory").asText("OTHER").toUpperCase(Locale.ROOT);
                ExpenseCategory category = ExpenseCategory.OTHER;
                try { category = ExpenseCategory.valueOf(catStr); } catch (Exception ignored) {}

                String formattedMoney = NumberFormat.getInstance(new Locale("vi", "VN")).format(amount) + " đ";

                if (!autoExecute) {
                    Map<String, Object> details = new LinkedHashMap<>();
                    details.put("Chuồng nuôi", barn.getName());
                    details.put("Khoản chi", category.name());
                    details.put("Số tiền", formattedMoney);

                    Map<String, Object> payload = new LinkedHashMap<>();
                    payload.put("actionType", "LOG_EXPENSE");
                    payload.put("barnId", barn.getId());
                    payload.put("cycleId", cycleOpt.get().getId());
                    payload.put("category", category.name());
                    payload.put("categoryLabel", category.name());
                    payload.put("amount", amount);

                    return AiAssistantResponse.builder()
                            .reply("Bạn có muốn ghi nhận chi phí **" + category.name() + "** số tiền **" + formattedMoney + "** cho **" + barn.getName() + "** không?")
                            .actionType("LOG_EXPENSE")
                            .executed(false)
                            .requiresConfirmation(true)
                            .pendingAction(Map.of(
                                    "actionType", "LOG_EXPENSE",
                                    "title", "Ghi nhận chi phí: " + barn.getName(),
                                    "description", category.name() + " • " + formattedMoney,
                                    "details", details,
                                    "payload", payload
                            ))
                            .build();
                }

                return commitLogExpense(barn, cycleOpt.get(), category, category.name(), amount, username);
            }

            case "IMPORT_PURCHASE_STOCK": {
                String invoiceCode = parsed.path("invoiceCode").asText("");
                if (!invoiceCode.isBlank() && !"null".equalsIgnoreCase(invoiceCode)) {
                    return handleImportStock(invoiceCode, autoExecute);
                }
                break;
            }

            case "COMPLETE_DAILY_TASKS": {
                return handleCompleteDailyTasks(norm, message, currentRoute, username, autoExecute);
            }

            default:
                break;
        }
        return null;
    }

    private AiAssistantResponse getSmartFallbackResponse(String rawMessage) {
        String norm = normalizeText(rawMessage);
        if (norm.contains("fcr") || norm.contains("he so fcr") || norm.contains("tieu ton thuc an")) {
            return AiAssistantResponse.builder()
                    .reply("📊 **Kỹ thuật kiểm soát FCR (Hệ số tiêu tốn thức ăn):**\n" +
                            "1. **Kiểm soát rơi vãi:** Điều chỉnh độ cao máng ăn ngang lưng gà, tránh đổ cám đầy quá 1/3 máng.\n" +
                            "2. **Chất lượng cám:** Đảm bảo cám không bị ẩm mốc, chọn đúng giai đoạn sinh trưởng (gà con úm, vỗ béo).\n" +
                            "3. **Môi trường chuồng:** Giữ nhiệt độ và thông thoáng thích hợp để gà không tiêu tốn năng lượng chống rét hay chống nóng.\n" +
                            "4. **Tẩy giun & phòng bệnh:** Kiểm soát cầu trùng và bệnh đường ruột định kỳ theo lịch.")
                    .actionType("GENERAL_QNA")
                    .executed(false)
                    .build();
        }
        if (norm.contains("um ga") || norm.contains("nhiet do um") || norm.contains("ga con")) {
            return AiAssistantResponse.builder()
                    .reply("🐥 **Hướng dẫn nhiệt độ và thông thoáng úm gà con:**\n" +
                            "• **Ngày 1 - 3:** 32 - 34°C, độ ẩm 65 - 70%.\n" +
                            "• **Ngày 4 - 7:** 30 - 32°C.\n" +
                            "• **Tuần 2:** 28 - 30°C.\n" +
                            "• **Tuần 3 trở đi:** 24 - 26°C.\n" +
                            "Quan sát đàn gà: Nếu gà tản đều ăn ngủ yên tĩnh là đủ nhiệt; tụm đống dưới chụp sưởi là lạnh; tản xa há mỏ thở là quá nóng.")
                    .actionType("GENERAL_QNA")
                    .executed(false)
                    .build();
        }
        if (norm.contains("chong nong") || norm.contains("oi buc") || norm.contains("stress nhiet") || norm.contains("nang nong")) {
            return AiAssistantResponse.builder()
                    .reply("☀️ **Biện pháp chống nóng và giảm stress nhiệt cho đàn gà:**\n" +
                            "1. Bật hệ thống quạt thông gió hết công suất và chạy giàn mát pad làm mát.\n" +
                            "2. Bổ sung Vitamin C, chất điện giải (Electrolytes) và đường Gluco vào nước uống từ 9h sáng đến 16h chiều.\n" +
                            "3. Cho gà ăn tập trung vào sáng sớm mát mẻ và chiều muộn, hạn chế cho ăn vào lúc cao điểm nắng gắt.\n" +
                            "4. Giảm bớt mật độ nuôi nếu chuồng quá dày.")
                    .actionType("GENERAL_QNA")
                    .executed(false)
                    .build();
        }
        if (norm.contains("vac xin") || norm.contains("lich tiem") || norm.contains("tiem phong")) {
            return AiAssistantResponse.builder()
                    .reply("💉 **Lịch phòng vắc-xin cơ bản cho gà thịt:**\n" +
                            "• **1 ngày tuổi:** Phòng Marek (tại lò ấp).\n" +
                            "• **3 - 5 ngày tuổi:** Nhỏ mắt/mũi ND-IB (Newcastle + Viêm phế quản truyền nhiễm).\n" +
                            "• **7 ngày tuổi:** Tiêm dưới da vắc-xin Cúm gia cầm (H5N1/H5N6).\n" +
                            "• **10 - 14 ngày tuổi:** Nhỏ hoặc uống Gumboro lần 1.\n" +
                            "• **18 - 21 ngày tuổi:** Nhắc lại ND-IB và Gumboro lần 2.")
                    .actionType("GENERAL_QNA")
                    .executed(false)
                    .build();
        }
        if (norm.contains("chao") || norm.contains("xin chao") || norm.contains("hello") || norm.contains("giup gi") || norm.contains("huong dan")) {
            return AiAssistantResponse.builder()
                    .reply("👋 **Xin chào! Tôi là Trợ lý AI điều hành trang trại FarmShift.** Bạn có thể trò chuyện hoặc ra lệnh bằng giọng nói:\n" +
                            "• **Ghi cám:** *\"Cho Nhà A1 ăn 50kg cám Higro 01\"*\n" +
                            "• **Cân mẫu:** *\"Nhà B1 cân mẫu 50 con được 1.82 kg\"*\n" +
                            "• **Hao hụt:** *\"Nhà A2 chết 3 con do sốc nhiệt\"*\n" +
                            "• **Chi phí:** *\"Ghi tiền điện tháng này 1 triệu 2 cho Nhà A1\"*\n" +
                            "• **Nhập kho:** *\"Xác nhận nhập kho đơn hàng NH000001\"*\n" +
                            "• **Hỏi đáp kỹ thuật:** *\"Nhiệt độ úm gà con bao nhiêu?\", \"Cách xử lý gà khò khè?\"*")
                    .actionType("GENERAL_QNA")
                    .executed(false)
                    .build();
        }

        return AiAssistantResponse.builder()
                .reply("Tôi đã ghi nhận thông tin: \"" + rawMessage + "\". Tôi có thể hỗ trợ bạn ghi nhật ký cho ăn, cân mẫu, báo cáo hao hụt, nhập kho hàng hóa hoặc giải đáp các thắc mắc chăn nuôi thú y.")
                .actionType("GENERAL_QNA")
                .executed(false)
                .build();
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // HELPERS & RESOLVERS
    // ─────────────────────────────────────────────────────────────────────────────

    private Barn resolveBarn(String norm, String originalMsg) {
        return resolveBarn(norm, originalMsg, null);
    }

    private Barn resolveBarn(String norm, String originalMsg, String currentRoute) {
        List<Barn> barns = new ArrayList<>(barnRepository.findAll());
        // Sort descending by name length to match specific names before substrings (e.g. "Nhà A10" before "Nhà A1")
        barns.sort((b1, b2) -> Integer.compare(b2.getName().length(), b1.getName().length()));

        for (Barn b : barns) {
            String bNorm = normalizeText(b.getName());
            if (norm.matches(".*\\b" + Pattern.quote(bNorm) + "\\b.*") || norm.contains(bNorm)) {
                return b;
            }
            // Match without "nhà" or "chuồng", e.g. "a1", "a2", "b1"
            String shortCode = bNorm.replace("nha", "").replace("chuong", "").trim();
            if (!shortCode.isBlank() && norm.matches(".*\\b" + Pattern.quote(shortCode) + "\\b.*")) {
                return b;
            }
        }

        // Context awareness: If currentRoute is like "/barns/1" or "/barns/12", resolve that barn!
        if (currentRoute != null) {
            Matcher m = Pattern.compile("/barns/(\\d+)").matcher(currentRoute);
            if (m.find()) {
                try {
                    Long barnId = Long.parseLong(m.group(1));
                    return barnRepository.findById(barnId).orElse(null);
                } catch (Exception ignored) {}
            }
        }

        return null;
    }

    private AiAssistantResponse barnNotFoundResponse(String norm) {
        List<Barn> allBarns = barnRepository.findAll();
        String available = allBarns.isEmpty() ? "Chưa có chuồng nào." :
                allBarns.stream().map(Barn::getName).collect(Collectors.joining(", "));
        return AiAssistantResponse.builder()
                .reply("⚠️ Không tìm thấy chuồng phù hợp trong hệ thống. Các chuồng hiện có gồm: **" + available + "**.")
                .actionType("NONE")
                .executed(false)
                .build();
    }

    private boolean hasBarnMention(String norm) {
        return hasBarnMention(norm, null);
    }

    private boolean hasBarnMention(String norm, String currentRoute) {
        if (currentRoute != null && currentRoute.matches(".*/barns/\\d+.*")) {
            return true;
        }
        if (norm == null) return false;
        return norm.contains("chuong") || norm.contains("nha ") || norm.matches(".*\\b(?:a|b|c|d)\\s*\\d+\\b.*");
    }

    private AiAssistantResponse cycleNotFoundResponse(Barn barn) {
        List<FarmingCycle> activeCycles = cycleRepository.findAllByStatus(CycleStatus.ACTIVE);
        String activeBarns = activeCycles.isEmpty() ? "Hiện tại chưa có chuồng nào có lứa nuôi hoạt động." :
                activeCycles.stream().map(c -> c.getBarn().getName()).distinct().collect(Collectors.joining(", "));
        return AiAssistantResponse.builder()
                .reply("⚠️ Chuồng **" + barn.getName() + "** hiện tại chưa có lứa nuôi hoạt động (`ACTIVE`). Các chuồng đang có lứa nuôi gồm: **" + activeBarns + "**.")
                .actionType("NONE")
                .executed(false)
                .build();
    }

    private void deductInventoryStock(String feedName, double kg) {
        String search = feedName.toLowerCase().replace("cám ", "").trim();
        List<InventoryItem> items = inventoryRepository.findAll();
        for (InventoryItem item : items) {
            if (item.getProduct() != null) {
                String pName = item.getProduct().getName().toLowerCase();
                if (pName.contains(search) || pName.contains(feedName.toLowerCase())) {
                    BigDecimal current = item.getStock() != null ? item.getStock() : BigDecimal.ZERO;
                    String unitName = item.getUnit() != null ? item.getUnit().getName().toLowerCase() : "";
                    BigDecimal deductAmount;
                    if (unitName.contains("bao")) {
                        deductAmount = BigDecimal.valueOf(kg / 25.0);
                    } else {
                        deductAmount = BigDecimal.valueOf(kg);
                    }
                    item.setStock(current.subtract(deductAmount).max(BigDecimal.ZERO));
                    inventoryRepository.save(item);
                    break;
                }
            }
        }
    }

    private static String normalizeText(String text) {
        if (text == null) return "";
        String normalized = Normalizer.normalize(text, Normalizer.Form.NFD);
        String unaccented = Pattern.compile("\\p{InCombiningDiacriticalMarks}+").matcher(normalized).replaceAll("");
        String result = unaccented.replace('đ', 'd').replace('Đ', 'D').toLowerCase(Locale.ROOT).trim();
        // Normalize letter followed by digit: "a 1" -> "a1", "b 2" -> "b2", "nh 000003" -> "nh000003"
        return result.replaceAll("\\b([a-z])\\s+(\\d+)\\b", "$1$2");
    }
}
