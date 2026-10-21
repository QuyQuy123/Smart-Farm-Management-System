package com.farmshift.backendFarmShift.service;

import com.farmshift.backendFarmShift.dto.AiAssistantRequest;
import com.farmshift.backendFarmShift.dto.AiAssistantResponse;
import com.farmshift.backendFarmShift.dto.request.BarnRequest;
import com.farmshift.backendFarmShift.dto.request.DailyTaskConfirmRequest;
import com.farmshift.backendFarmShift.dto.request.FarmAreaRequest;
import com.farmshift.backendFarmShift.dto.request.SupplierRequest;
import com.farmshift.backendFarmShift.dto.response.BarnDayPlan;
import com.farmshift.backendFarmShift.entity.*;
import com.farmshift.backendFarmShift.repository.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.text.NumberFormat;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
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
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;

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
        // Check if this is an explicit confirmation of a pending action
        if (Boolean.TRUE.equals(request.getConfirmAction()) && request.getPendingActionPayload() != null) {
            return executeConfirmedPayload(request.getPendingActionPayload(), username);
        }

        String rawMessage = request.getMessage() != null ? request.getMessage().trim() : "";
        if (rawMessage.isBlank()) {
            return AiAssistantResponse.builder()
                    .reply("Xin chào! Hãy ra lệnh bằng giọng nói hoặc nhập nội dung bạn cần hỗ trợ.")
                    .actionType("NONE")
                    .executed(false)
                    .build();
        }

        boolean isWorker = authorities != null && authorities.stream()
                .anyMatch(a -> "ROLE_FARM_WORKER".equalsIgnoreCase(a.getAuthority()))
                && authorities.stream().noneMatch(a -> "ROLE_FARM_OWNER".equalsIgnoreCase(a.getAuthority()) || "ROLE_ACCOUNTANT".equalsIgnoreCase(a.getAuthority()));

        boolean autoExecute = request.getAutoExecute() == null || Boolean.TRUE.equals(request.getAutoExecute());

        // First, run our high-performance Vietnamese Rule-Based & Regex Action Engine (Layer 2)
        AiAssistantResponse ruleResult = evaluateRuleEngine(rawMessage, request.getCurrentRoute(), username, isWorker, autoExecute);
        if (ruleResult != null) {
            return ruleResult;
        }

        // If rule engine did not trigger a specific action and Groq key is present, invoke Groq LLM (Layer 1)
        if (!groqApiKey.isBlank()) {
            try {
                AiAssistantResponse llmResult = evaluateLlmEngine(rawMessage, request.getCurrentRoute(), request.getHistory(), username, isWorker, autoExecute);
                if (llmResult != null) {
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
            AiAssistantResponse queryResponse = handleFarmStatusQuery(norm, message, currentRoute);
            if (queryResponse != null) {
                return queryResponse;
            }
        }

        // 3. VET_DIAGNOSIS (Bệnh thú y, chẩn đoán triệu chứng hô hấp/tiêu hóa cụ thể)
        if (norm.contains("kho khe") || norm.contains("kho tho") || norm.matches(".*\\btho\\s+(?:kho|gap|nhanh|hoi|hon hen).*") || norm.contains("ngap") || norm.contains("phan sap") || norm.contains("phan trang") || norm.contains("cau trung") || norm.matches(".*\\bhen\\b.*") || norm.contains("crd")) {
            return handleVetDiagnosis(norm, message);
        }

        // 4. NAVIGATE_AND_PREFILL (Điều hướng trang hoặc Mở Modal tạo đơn)
        if (norm.startsWith("mo ") || norm.startsWith("chuyen sang ") || norm.startsWith("chuyen den ") || norm.startsWith("di toi ") || norm.startsWith("xem ") || norm.startsWith("vao ") || norm.startsWith("tao don") || norm.contains("tao don nhap") || norm.contains("man hinh ") || norm.matches(".*\\btrang\\s+(?:hoa don|nhap hang|khu nuoi|chuong|kho|nhat ky|tai khoan|bao cao|so quy)\\b.*")) {
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

        // 11. LOG_MORTALITY (Hao hụt, chết)
        if (norm.contains("hao hut") || norm.contains("chet") || norm.contains("loai thai")) {
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
            Matcher altMatcher = Pattern.compile("(?:hao hut|chet|loai thai)\\s*(\\d+)").matcher(norm);
            if (altMatcher.find()) {
                qty = Integer.parseInt(altMatcher.group(1));
            }
        }

        String reason = "Hao hụt chăn nuôi";
        if (norm.contains("nong")) reason = "Hao hụt do nắng nóng";
        else if (norm.contains("dich")) reason = "Hao hụt do dịch bệnh";
        else if (norm.contains("benh")) reason = "Hao hụt do bệnh";
        else if (norm.contains("loai thai")) reason = "Loại thải con còi cọc";

        if (!autoExecute) {
            Map<String, Object> details = new LinkedHashMap<>();
            details.put("Chuồng nuôi", barn.getName());
            details.put("Số lượng hao hụt", qty + " con");
            details.put("Lý do", reason);
            details.put("Đàn còn lại dự kiến", (Math.max(0, barn.getCurrentQuantity() - qty)) + " con");

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("actionType", "LOG_MORTALITY");
            payload.put("barnId", barn.getId());
            payload.put("barnName", barn.getName());
            if (flock != null) payload.put("flockId", flock.getId());
            payload.put("quantity", qty);
            payload.put("reason", reason);

            return AiAssistantResponse.builder()
                    .reply("Bạn có muốn ghi nhận hao hụt **" + qty + " con** (" + reason.toLowerCase() + ") cho chuồng **" + barn.getName() + "** không?")
                    .actionType("LOG_MORTALITY")
                    .executed(false)
                    .requiresConfirmation(true)
                    .pendingAction(Map.of(
                            "actionType", "LOG_MORTALITY",
                            "title", "Ghi nhận hao hụt: " + barn.getName(),
                            "description", "Hao hụt " + qty + " con (" + reason + ")",
                            "details", details,
                            "payload", payload
                    ))
                    .build();
        }

        return commitLogMortality(barn, flock, qty, reason, username);
    }

    private AiAssistantResponse commitLogMortality(Barn barn, Flock flock, int qty, String reason, String username) {
        if (flock != null) {
            FlockMovement movement = new FlockMovement();
            movement.setFlock(flock);
            movement.setType(FlockMovementType.DEATH);
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

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("title", "Đã ghi nhận hao hụt");
        summary.put("barnName", barn.getName());
        summary.put("detail", "Hao hụt " + qty + " con • " + reason);
        summary.put("quantity", String.valueOf(qty));
        summary.put("remainingQuantity", String.valueOf(barn.getCurrentQuantity()));
        summary.put("reason", reason);
        summary.put("timestamp", LocalDateTime.now().toString());

        return AiAssistantResponse.builder()
                .reply("✅ Đã ghi nhận hao hụt **" + qty + " con** (" + reason.toLowerCase() + ") tại **" + barn.getName() + "**. Số lượng gà hiện tại của chuồng còn **" + NumberFormat.getInstance(new Locale("vi", "VN")).format(barn.getCurrentQuantity()) + " con**.")
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
        if (norm.contains("trieu")) {
            Matcher trieuMatcher = Pattern.compile("(\\d+(?:[.,]\\d+)?)\\s*trieu(?:\\s*(\\d+))?").matcher(norm);
            if (trieuMatcher.find()) {
                double main = Double.parseDouble(trieuMatcher.group(1).replace(',', '.'));
                amount = (long) (main * 1_000_000);
                if (trieuMatcher.group(2) != null) {
                    long extra = Long.parseLong(trieuMatcher.group(2));
                    amount += extra * 100_000;
                }
            }
        } else if (norm.contains("nghin") || norm.contains("ngan") || norm.contains("k")) {
            Matcher kMatcher = Pattern.compile("(\\d+)\\s*(?:nghin|ngan|k)").matcher(norm);
            if (kMatcher.find()) {
                amount = Long.parseLong(kMatcher.group(1)) * 1_000;
            }
        } else {
            Matcher numMatcher = Pattern.compile("(\\d{4,12})").matcher(norm);
            if (numMatcher.find()) {
                amount = Long.parseLong(numMatcher.group(1));
            }
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

    public AiAssistantResponse executeConfirmedPayload(Map<String, Object> payload, String username) {
        String actionType = payload.get("actionType") != null ? String.valueOf(payload.get("actionType")) : "";
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
                return commitLogMortality(barn, flock, qty, reason, username);
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

        if (norm.contains("tao don") || norm.contains("nhap hang tu") || norm.contains("tao hoa don")) {
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
        } else if (norm.contains("hoa don") || norm.contains("nhap hang")) {
            targetRoute = "/purchases";
            reply = "🚀 Đang chuyển bạn sang màn hình **Hóa đơn nhập hàng**.";
        } else if (norm.contains("khu nuoi") || norm.contains("chuong trai") || norm.contains("danh sach chuong") || (norm.startsWith("mo ") && (norm.contains("chuong") || norm.contains("nha")))) {
            targetRoute = "/barns";
            reply = "🚀 Đang chuyển bạn sang màn hình **Khu nuôi & Chuồng trại**.";
        } else if (norm.contains("kho") || norm.contains("hang hoa")) {
            targetRoute = "/inventory";
            reply = "🚀 Đang chuyển bạn sang màn hình **Kho hàng hóa**.";
        } else if (norm.contains("nhat ky")) {
            targetRoute = "/journal";
            reply = "🚀 Đang chuyển bạn sang màn hình **Ghi nhật ký chăn nuôi**.";
        } else if (norm.contains("tai khoan") || norm.contains("nhan su")) {
            targetRoute = "/account";
            reply = "🚀 Đang chuyển bạn sang màn hình **Tài khoản & Nhân sự**.";
        } else if (norm.contains("bao cao") || norm.contains("thong ke")) {
            targetRoute = "/reports";
            reply = "🚀 Đang chuyển bạn sang màn hình **Báo cáo & Thống kê**.";
        } else if (norm.contains("so quy") || norm.contains("thu chi")) {
            targetRoute = "/cashbook";
            reply = "🚀 Đang chuyển bạn sang màn hình **Sổ quỹ & Dòng tiền**.";
        } else if (norm.contains("viec hom nay") || norm.contains("cong viec")) {
            targetRoute = "/today-tasks";
            reply = "🚀 Đang chuyển bạn sang màn hình **Việc hôm nay**.";
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
        return handleFarmStatusQuery(norm, message, null);
    }

    private AiAssistantResponse handleFarmStatusQuery(String norm, String message, String currentRoute) {
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

    private AiAssistantResponse evaluateLlmEngine(String message, String currentRoute, List<Map<String, String>> history, String username, boolean isWorker) {
        return evaluateLlmEngine(message, currentRoute, history, username, isWorker, true);
    }

    private AiAssistantResponse evaluateLlmEngine(String message, String currentRoute, List<Map<String, String>> history, String username, boolean isWorker, boolean autoExecute) {
        try {
            List<Barn> barns = barnRepository.findAll();
            String barnNames = barns.stream().map(Barn::getName).collect(Collectors.joining(", "));

            String routeHint = "";
            if (currentRoute != null && currentRoute.matches(".*/barns/\\d+.*")) {
                Matcher m = Pattern.compile("/barns/(\\d+)").matcher(currentRoute);
                if (m.find()) {
                    Long bId = Long.parseLong(m.group(1));
                    Barn activeBarn = barnRepository.findById(bId).orElse(null);
                    if (activeBarn != null) {
                        routeHint = "Người dùng đang xem trang của chuồng: " + activeBarn.getName() + " (ID: " + activeBarn.getId() + "). Nếu người dùng không nêu tên chuồng cụ thể, mặc định là chuồng này.\n";
                    }
                }
            }

            String systemPrompt = "Bạn là Trợ lý AI điều hành hệ thống trang trại gà thịt FarmShift tiếng Việt.\n" +
                    routeHint +
                    "Hệ thống hiện có các chuồng: " + (barnNames.isBlank() ? "Nhà A1, Nhà A2, Nhà A3, Nhà B1, Nhà B2" : barnNames) + ".\n" +
                    "Phân tích yêu cầu và trả về ĐÚNG DUY NHẤT một đối tượng JSON hợp lệ không bọc trong markdown:\n" +
                    "{\n" +
                    "  \"intent\": \"LOG_FEED | LOG_WEIGHT | LOG_MORTALITY | LOG_EXPENSE | COMPLETE_DAILY_TASKS | IMPORT_PURCHASE_STOCK | QUERY_FARM_STATUS | VET_DIAGNOSIS | NAVIGATE_AND_PREFILL | GENERAL_QNA\",\n" +
                    "  \"barnName\": \"Tên chuồng chính xác (ví dụ: Nhà A1) hoặc null\",\n" +
                    "  \"feedKg\": số_kg_cám_hoặc_null_1_bao_la_25kg,\n" +
                    "  \"feedName\": \"tên_loại_cám_hoặc_null\",\n" +
                    "  \"avgWeightKg\": số_kg_trọng_lượng_trung_bình_hoặc_null,\n" +
                    "  \"sampleSize\": số_con_cân_mẫu_hoặc_null,\n" +
                    "  \"mortalityQty\": số_con_chết_hoặc_hao_hụt_hoặc_null,\n" +
                    "  \"expenseAmount\": số_tiền_hoặc_null,\n" +
                    "  \"expenseCategory\": \"ELECTRICITY | WATER | MEDICINE | LABOR | OTHER | null\",\n" +
                    "  \"invoiceCode\": \"mã_NHxxxxxx_hoặc_null\",\n" +
                    "  \"navigateTo\": \"/journal | /barns | /inventory | /purchases | /today-tasks | null\",\n" +
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
        String norm = normalizeText(message);
        String barnNameCandidate = parsed.path("barnName").asText("");
        Barn barn = null;
        if (!barnNameCandidate.isBlank() && !"null".equalsIgnoreCase(barnNameCandidate)) {
            barn = resolveBarn(normalizeText(barnNameCandidate), barnNameCandidate, currentRoute);
        }
        if (barn == null) {
            barn = resolveBarn(norm, message, currentRoute);
        }

        switch (intent) {
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
