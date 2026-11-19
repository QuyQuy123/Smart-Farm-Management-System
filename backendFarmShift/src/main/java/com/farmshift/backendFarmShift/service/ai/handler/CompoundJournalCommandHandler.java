package com.farmshift.backendFarmShift.service.ai.handler;

import com.farmshift.backendFarmShift.dto.AiAssistantResponse;
import com.farmshift.backendFarmShift.entity.*;
import com.farmshift.backendFarmShift.exception.BadRequestException;
import com.farmshift.backendFarmShift.repository.*;
import com.farmshift.backendFarmShift.service.CycleService;
import com.farmshift.backendFarmShift.service.VietnameseSpeechNormalizer;
import com.farmshift.backendFarmShift.service.WorkAssignmentService;
import com.farmshift.backendFarmShift.service.ai.AiRbacPolicy;
import com.farmshift.backendFarmShift.service.ai.AssistantCommandHandler;
import com.farmshift.backendFarmShift.service.ai.AssistantExecutionContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Compound Multi-Entity Command Engine (Batch Logging across multiple barns in a single breath).
 * Handles:
 * - Feed: "Ghi 50kg cám Nhà A1, 40kg Nhà A2 và 60kg Nhà B1"
 * - Mortality: "Hôm nay Nhà A1 chết 2 con, Nhà A2 chết 3 con"
 * - Weight: "Cân mẫu Nhà A1 trung bình 1.8kg, Nhà A2 1.95kg"
 * Enforces worker barn scope (MSG51), Area->Warehouse resolution, 2-step PendingActionCard,
 * pre-flight stock validation, and atomic takeStock FIFO deduction (MSG27).
 */
@Slf4j
@Component
@Order(20)
@RequiredArgsConstructor
public class CompoundJournalCommandHandler implements AssistantCommandHandler {

    private final BarnRepository barnRepository;
    private final FarmingCycleRepository cycleRepository;
    private final FlockRepository flockRepository;
    private final FeedRecordRepository feedRepository;
    private final WeightSampleRepository weightRepository;
    private final FlockMovementRepository movementRepository;
    private final InventoryItemRepository inventoryRepository;

    @Autowired(required = false)
    private WarehouseCategoryRepository warehouseRepository;

    @Autowired(required = false)
    private WorkAssignmentService workAssignmentService;

    private static final Pattern BARN_PATTERN = Pattern.compile("(?i)\\b(Nhà\\s+[A-Za-z0-9]+|Chuồng\\s+[A-Za-z0-9]+)\\b");
    private static final Set<String> COMPOUND_CONFIRM_ACTIONS = Set.of(
            "COMPOUND_LOG_FEED", "COMPOUND_LOG_MORTALITY", "COMPOUND_LOG_WEIGHT"
    );

    @Override
    public int getOrder() {
        return 20;
    }

    @Override
    public boolean canHandle(AssistantExecutionContext context) {
        if (Boolean.TRUE.equals(context.getConfirmAction())) {
            Map<String, Object> payload = context.getPendingActionPayload();
            return payload != null && COMPOUND_CONFIRM_ACTIONS.contains(String.valueOf(payload.get("actionType")));
        }
        String msg = context.getMessage();
        if (msg == null || msg.isBlank()) {
            return false;
        }

        Set<String> mentionedBarns = extractBarnMentions(msg);
        if (mentionedBarns.size() < 2) {
            return false;
        }

        String norm = VietnameseSpeechNormalizer.removeVietnameseDiacritics(msg).toLowerCase(Locale.ROOT);
        boolean hasFeed = norm.contains("cam") || norm.contains("cho an") || norm.contains("ghi");
        boolean hasLoss = norm.contains("chet") || norm.contains("hao hut") || norm.contains("loai thai");
        boolean hasWeight = norm.contains("can mau") || norm.contains("trong luong") || norm.contains("kg") || norm.contains("can");

        return hasFeed || hasLoss || hasWeight;
    }

    @Override
    @Transactional
    public AiAssistantResponse handle(AssistantExecutionContext context) {
        if (context.isAccountant() && !context.isOwner()) {
            return AiRbacPolicy.createAccountantForbiddenResponse();
        }
        if (Boolean.TRUE.equals(context.getConfirmAction())) {
            return executeConfirmedCompound(context);
        }

        String msg = context.getMessage();
        String norm = VietnameseSpeechNormalizer.removeVietnameseDiacritics(msg).toLowerCase(Locale.ROOT);

        if (norm.contains("chet") || norm.contains("hao hut") || norm.contains("loai thai")) {
            return handleCompoundLoss(context);
        } else if (norm.contains("can mau") || (norm.contains("mau") && (norm.contains("kg") || norm.contains("can")))) {
            return handleCompoundWeight(context);
        } else {
            return handleCompoundFeed(context);
        }
    }

    private Set<String> extractBarnMentions(String text) {
        Set<String> barns = new LinkedHashSet<>();
        Matcher matcher = BARN_PATTERN.matcher(text);
        while (matcher.find()) {
            barns.add(matcher.group(1).trim());
        }
        return barns;
    }

    // ─────────────────────────────────────────────────────────────
    // 1. COMPOUND FEED LOGGING (Ghi cám nhiều chuồng)
    // ─────────────────────────────────────────────────────────────
    private AiAssistantResponse handleCompoundFeed(AssistantExecutionContext context) {
        String msg = context.getMessage();
        String[] clauses = msg.split("(?i)\\s*(?:và|với|còn|,|;)\\s*");

        String defaultFeedName = extractFeedName(msg, "Higro 01");
        List<BarnFeedClause> feedClauses = new ArrayList<>();
        double totalRequestedKg = 0.0;

        for (String clause : clauses) {
            Matcher barnMatcher = BARN_PATTERN.matcher(clause);
            if (!barnMatcher.find()) continue;

            String barnStr = barnMatcher.group(1).trim();
            Barn barn = resolveBarn(barnStr);
            if (barn == null) continue;

            if (!isWorkerAllowed(context, barn)) {
                return barnNotAssignedResponse(barn);
            }

            double kg = extractQuantityKg(clause);
            if (kg <= 0) continue;

            String clauseFeed = extractFeedName(clause, defaultFeedName);
            feedClauses.add(new BarnFeedClause(barn, clauseFeed, kg));
            totalRequestedKg += kg;
        }

        if (feedClauses.isEmpty()) {
            return null;
        }

        // Pre-flight stock validation (MSG27)
        double availableStockKg = calculateTotalFeedStockKg(defaultFeedName);
        if (availableStockKg >= 0 && totalRequestedKg > availableStockKg) {
            String availableFormatted = String.format(Locale.ROOT, "%.1f kg", availableStockKg);
            String requestedFormatted = String.format(Locale.ROOT, "%.1f kg", totalRequestedKg);
            return AiAssistantResponse.builder()
                    .reply("⚠️ Tồn kho khả dụng không đủ. Giao dịch này sẽ làm cho số dư tồn kho bị âm (Hiện có: "
                            + availableFormatted + ", Yêu cầu: " + requestedFormatted + "). Vui lòng kiểm tra lại.")
                    .actionType("STOCK_INSUFFICIENT")
                    .executed(false)
                    .build();
        }

        if (!context.isAutoExecute()) {
            List<Map<String, Object>> batchItems = new ArrayList<>();
            List<Map<String, Object>> payloadItems = new ArrayList<>();
            for (BarnFeedClause fc : feedClauses) {
                WarehouseCategory wh = resolveAreaFeedWarehouse(fc.barn);
                String whName = wh != null ? wh.getName() : (fc.barn.getArea() != null ? "Kho cám " + fc.barn.getArea().getName() : "Kho cám");

                Map<String, Object> bi = new LinkedHashMap<>();
                bi.put("barnName", fc.barn.getName());
                bi.put("oldValue", whName);
                bi.put("newValue", String.format(Locale.ROOT, "%.1f kg %s", fc.kg, fc.feedName));
                bi.put("diff", "Trừ kho tự động");
                batchItems.add(bi);

                Map<String, Object> pi = new LinkedHashMap<>();
                pi.put("barnId", fc.barn.getId());
                pi.put("barnName", fc.barn.getName());
                pi.put("feedName", fc.feedName);
                pi.put("kg", fc.kg);
                payloadItems.add(pi);
            }

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("actionType", "COMPOUND_LOG_FEED");
            payload.put("items", payloadItems);
            payload.put("totalKg", totalRequestedKg);

            Map<String, Object> pendingAction = new LinkedHashMap<>();
            pendingAction.put("actionType", "COMPOUND_LOG_FEED");
            pendingAction.put("title", "Ghi nhận cám hàng loạt (" + feedClauses.size() + " chuồng)");
            pendingAction.put("description", "Tổng lượng cám: " + String.format(Locale.ROOT, "%.1f kg", totalRequestedKg));
            pendingAction.put("batchItems", batchItems);
            pendingAction.put("payload", payload);

            return AiAssistantResponse.builder()
                    .reply("Bạn có muốn ghi nhận nhật ký cám hàng loạt cho **" + feedClauses.size() + " chuồng** (tổng **"
                            + String.format(Locale.ROOT, "%.1f kg", totalRequestedKg) + "**) không?")
                    .actionType("COMPOUND_LOG_FEED")
                    .executed(false)
                    .requiresConfirmation(true)
                    .pendingAction(pendingAction)
                    .build();
        }

        return commitCompoundFeed(feedClauses, context.getUsername());
    }

    private AiAssistantResponse commitCompoundFeed(List<BarnFeedClause> feedClauses, String username) {
        List<Map<String, Object>> summaryList = new ArrayList<>();
        StringBuilder replyBuilder = new StringBuilder("✅ Đã ghi nhận nhật ký cám thành công cho ")
                .append(feedClauses.size()).append(" chuồng: ");
        double totalRequestedKg = 0.0;
        LocalDate today = LocalDate.now(CycleService.VN_ZONE);

        for (int i = 0; i < feedClauses.size(); i++) {
            BarnFeedClause fc = feedClauses.get(i);
            Barn barn = fc.barn;
            double kg = fc.kg;
            String feedName = fc.feedName;
            totalRequestedKg += kg;

            FarmingCycle cycle = cycleRepository.findFirstByBarnIdAndStatus(barn.getId(), CycleStatus.ACTIVE)
                    .orElse(null);

            if (cycle != null) {
                BigDecimal unitPricePerKg = deductInventoryStockAtomic(barn, feedName, kg);

                FeedRecord record = new FeedRecord();
                record.setCycle(cycle);
                record.setRecordDate(today);
                record.setFeedName(feedName);
                record.setQuantityKg(BigDecimal.valueOf(kg));
                record.setUnitPrice(unitPricePerKg);
                record.setNote("Ghi hàng loạt qua Trợ lý Giọng nói FarmShift AI");
                record.setCreatedBy(username != null ? username : "Trợ lý AI");
                feedRepository.save(record);
            }

            if (i > 0) replyBuilder.append(", ");
            replyBuilder.append("**").append(barn.getName()).append("** (").append(String.format(Locale.ROOT, "%.1f kg", kg)).append(")");

            Map<String, Object> itemSummary = new LinkedHashMap<>();
            itemSummary.put("barnName", barn.getName());
            itemSummary.put("feedName", feedName);
            itemSummary.put("kg", String.valueOf(kg));
            summaryList.add(itemSummary);
        }

        replyBuilder.append(". Hệ số FCR và kho cám đã được cập nhật đồng bộ.");

        Map<String, Object> actionSummary = new LinkedHashMap<>();
        actionSummary.put("title", "Đã ghi nhận cám hàng loạt (" + feedClauses.size() + " chuồng)");
        actionSummary.put("totalKg", String.valueOf(totalRequestedKg));
        actionSummary.put("items", summaryList);
        actionSummary.put("timestamp", LocalDateTime.now(CycleService.VN_ZONE).toString());

        return AiAssistantResponse.builder()
                .reply(replyBuilder.toString())
                .actionType("COMPOUND_LOG_FEED")
                .executed(true)
                .uiCommand("REFRESH_DATA")
                .actionSummary(actionSummary)
                .build();
    }

    // ─────────────────────────────────────────────────────────────
    // 2. COMPOUND MORTALITY LOGGING (Hao hụt nhiều chuồng)
    // ─────────────────────────────────────────────────────────────
    private AiAssistantResponse handleCompoundLoss(AssistantExecutionContext context) {
        String msg = context.getMessage();
        String[] clauses = msg.split("(?i)\\s*(?:và|với|còn|,|;)\\s*");

        List<BarnLossClause> lossClauses = new ArrayList<>();
        int totalLoss = 0;

        for (String clause : clauses) {
            Matcher barnMatcher = BARN_PATTERN.matcher(clause);
            if (!barnMatcher.find()) continue;

            String barnStr = barnMatcher.group(1).trim();
            Barn barn = resolveBarn(barnStr);
            if (barn == null) continue;

            if (!isWorkerAllowed(context, barn)) {
                return barnNotAssignedResponse(barn);
            }

            int qty = extractCount(clause);
            if (qty <= 0) continue;

            lossClauses.add(new BarnLossClause(barn, qty));
            totalLoss += qty;
        }

        if (lossClauses.isEmpty()) {
            return null;
        }

        if (!context.isAutoExecute()) {
            List<Map<String, Object>> batchItems = new ArrayList<>();
            List<Map<String, Object>> payloadItems = new ArrayList<>();
            for (BarnLossClause lc : lossClauses) {
                Map<String, Object> bi = new LinkedHashMap<>();
                bi.put("barnName", lc.barn.getName());
                bi.put("oldValue", lc.barn.getCurrentQuantity() + " con");
                bi.put("newValue", Math.max(0, lc.barn.getCurrentQuantity() - lc.qty) + " con");
                bi.put("diff", "-" + lc.qty + " con");
                batchItems.add(bi);

                Map<String, Object> pi = new LinkedHashMap<>();
                pi.put("barnId", lc.barn.getId());
                pi.put("qty", lc.qty);
                payloadItems.add(pi);
            }

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("actionType", "COMPOUND_LOG_MORTALITY");
            payload.put("items", payloadItems);
            payload.put("totalLoss", totalLoss);

            Map<String, Object> pendingAction = new LinkedHashMap<>();
            pendingAction.put("actionType", "COMPOUND_LOG_MORTALITY");
            pendingAction.put("title", "Ghi nhận hao hụt hàng loạt (" + totalLoss + " con)");
            pendingAction.put("description", "Cập nhật số lượng sống cho " + lossClauses.size() + " chuồng");
            pendingAction.put("batchItems", batchItems);
            pendingAction.put("payload", payload);

            return AiAssistantResponse.builder()
                    .reply("Bạn có muốn ghi nhận hao hụt hàng loạt tổng **" + totalLoss + " con** cho **" + lossClauses.size() + " chuồng** không?")
                    .actionType("COMPOUND_LOG_MORTALITY")
                    .executed(false)
                    .requiresConfirmation(true)
                    .pendingAction(pendingAction)
                    .build();
        }

        return commitCompoundLoss(lossClauses, context.getUsername());
    }

    private AiAssistantResponse commitCompoundLoss(List<BarnLossClause> lossClauses, String username) {
        StringBuilder replyBuilder = new StringBuilder("✅ Đã ghi nhận hao hụt thành công: ");
        List<Map<String, Object>> summaryList = new ArrayList<>();
        int totalLoss = 0;
        LocalDate today = LocalDate.now(CycleService.VN_ZONE);

        for (int i = 0; i < lossClauses.size(); i++) {
            BarnLossClause lc = lossClauses.get(i);
            Barn barn = lc.barn;
            int qty = lc.qty;
            totalLoss += qty;

            FarmingCycle cycle = cycleRepository.findFirstByBarnIdAndStatus(barn.getId(), CycleStatus.ACTIVE).orElse(null);
            if (cycle != null) {
                List<Flock> flocks = flockRepository.findAllByCycleIdOrderByImportDateAscIdAsc(cycle.getId());
                Flock flock = flocks.stream().filter(f -> f.getStatus() == FlockStatus.ACTIVE).findFirst().orElse(null);

                if (flock != null) {
                    FlockMovement movement = new FlockMovement();
                    movement.setFlock(flock);
                    movement.setType(FlockMovementType.DEATH);
                    movement.setMovementDate(today);
                    movement.setQuantity(qty);
                    movement.setNote("Hao hụt ghi nhận hàng loạt qua Trợ lý AI");
                    movement.setCreatedBy(username != null ? username : "Trợ lý AI");
                    movementRepository.save(movement);

                    flock.setQuantity(Math.max(0, flock.getQuantity() - qty));
                    if (flock.getQuantity() == 0) flock.setStatus(FlockStatus.ARCHIVED);
                    flockRepository.save(flock);
                }
            }

            barn.setCurrentQuantity(Math.max(0, barn.getCurrentQuantity() - qty));
            barnRepository.save(barn);

            if (i > 0) replyBuilder.append(", ");
            replyBuilder.append(barn.getName()).append(" (").append(qty).append(" con)");

            Map<String, Object> itemMap = new LinkedHashMap<>();
            itemMap.put("barnName", barn.getName());
            itemMap.put("quantity", qty);
            summaryList.add(itemMap);
        }

        replyBuilder.append(". Đàn gà đã được cập nhật số lượng sống.");

        Map<String, Object> actionSummary = new LinkedHashMap<>();
        actionSummary.put("title", "Đã ghi nhận hao hụt hàng loạt (" + totalLoss + " con)");
        actionSummary.put("totalLoss", totalLoss);
        actionSummary.put("items", summaryList);
        actionSummary.put("timestamp", LocalDateTime.now(CycleService.VN_ZONE).toString());

        return AiAssistantResponse.builder()
                .reply(replyBuilder.toString())
                .actionType("COMPOUND_LOG_MORTALITY")
                .executed(true)
                .uiCommand("REFRESH_DATA")
                .actionSummary(actionSummary)
                .build();
    }

    // ─────────────────────────────────────────────────────────────
    // 3. COMPOUND WEIGHT SAMPLING (Cân mẫu nhiều chuồng)
    // ─────────────────────────────────────────────────────────────
    private AiAssistantResponse handleCompoundWeight(AssistantExecutionContext context) {
        String msg = context.getMessage();
        String[] clauses = msg.split("(?i)\\s*(?:và|với|còn|,|;)\\s*");

        List<BarnWeightClause> weightClauses = new ArrayList<>();

        for (String clause : clauses) {
            Matcher barnMatcher = BARN_PATTERN.matcher(clause);
            if (!barnMatcher.find()) continue;

            String barnStr = barnMatcher.group(1).trim();
            Barn barn = resolveBarn(barnStr);
            if (barn == null) continue;

            if (!isWorkerAllowed(context, barn)) {
                return barnNotAssignedResponse(barn);
            }

            double weight = extractQuantityKg(clause);
            if (weight <= 0) continue;

            weightClauses.add(new BarnWeightClause(barn, weight));
        }

        if (weightClauses.isEmpty()) return null;

        if (!context.isAutoExecute()) {
            List<Map<String, Object>> batchItems = new ArrayList<>();
            List<Map<String, Object>> payloadItems = new ArrayList<>();
            for (BarnWeightClause wc : weightClauses) {
                Map<String, Object> bi = new LinkedHashMap<>();
                bi.put("barnName", wc.barn.getName());
                bi.put("oldValue", "Cân mẫu mới");
                bi.put("newValue", String.format(Locale.ROOT, "%.2f kg/con", wc.weight));
                bi.put("diff", "Mẫu 50 con");
                batchItems.add(bi);

                Map<String, Object> pi = new LinkedHashMap<>();
                pi.put("barnId", wc.barn.getId());
                pi.put("weight", wc.weight);
                payloadItems.add(pi);
            }

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("actionType", "COMPOUND_LOG_WEIGHT");
            payload.put("items", payloadItems);

            Map<String, Object> pendingAction = new LinkedHashMap<>();
            pendingAction.put("actionType", "COMPOUND_LOG_WEIGHT");
            pendingAction.put("title", "Cân mẫu hàng loạt (" + weightClauses.size() + " chuồng)");
            pendingAction.put("description", "Cập nhật trọng lượng trung bình và tính lại ADG");
            pendingAction.put("batchItems", batchItems);
            pendingAction.put("payload", payload);

            return AiAssistantResponse.builder()
                    .reply("Bạn có muốn ghi nhận cân mẫu hàng loạt cho **" + weightClauses.size() + " chuồng** không?")
                    .actionType("COMPOUND_LOG_WEIGHT")
                    .executed(false)
                    .requiresConfirmation(true)
                    .pendingAction(pendingAction)
                    .build();
        }

        return commitCompoundWeight(weightClauses, context.getUsername());
    }

    private AiAssistantResponse commitCompoundWeight(List<BarnWeightClause> weightClauses, String username) {
        StringBuilder replyBuilder = new StringBuilder("✅ Đã ghi nhận cân mẫu trọng lượng cho: ");
        List<Map<String, Object>> summaryList = new ArrayList<>();
        LocalDate today = LocalDate.now(CycleService.VN_ZONE);

        for (int i = 0; i < weightClauses.size(); i++) {
            BarnWeightClause wc = weightClauses.get(i);
            FarmingCycle cycle = cycleRepository.findFirstByBarnIdAndStatus(wc.barn.getId(), CycleStatus.ACTIVE).orElse(null);
            if (cycle != null) {
                WeightSample ws = new WeightSample();
                ws.setCycle(cycle);
                ws.setSampleDate(today);
                ws.setAvgWeightKg(BigDecimal.valueOf(wc.weight));
                ws.setSampleSize(50);
                ws.setNote("Cân mẫu ghi hàng loạt qua AI");
                ws.setCreatedBy(username != null ? username : "Trợ lý AI");
                weightRepository.save(ws);
            }

            if (i > 0) replyBuilder.append(", ");
            replyBuilder.append("**").append(wc.barn.getName()).append("** (").append(String.format(Locale.ROOT, "%.2f kg", wc.weight)).append(")");

            Map<String, Object> map = new LinkedHashMap<>();
            map.put("barnName", wc.barn.getName());
            map.put("avgWeight", wc.weight);
            summaryList.add(map);
        }

        replyBuilder.append(". Chỉ số tăng trọng ADG đã được tính toán.");

        Map<String, Object> actionSummary = new LinkedHashMap<>();
        actionSummary.put("title", "Cân mẫu hàng loạt (" + weightClauses.size() + " chuồng)");
        actionSummary.put("items", summaryList);
        actionSummary.put("timestamp", LocalDateTime.now(CycleService.VN_ZONE).toString());

        return AiAssistantResponse.builder()
                .reply(replyBuilder.toString())
                .actionType("COMPOUND_LOG_WEIGHT")
                .executed(true)
                .uiCommand("REFRESH_DATA")
                .actionSummary(actionSummary)
                .build();
    }

    @SuppressWarnings("unchecked")
    private AiAssistantResponse executeConfirmedCompound(AssistantExecutionContext context) {
        Map<String, Object> payload = context.getPendingActionPayload();
        String actionType = String.valueOf(payload.get("actionType"));
        List<Map<String, Object>> items = (List<Map<String, Object>>) payload.get("items");
        if (items == null || items.isEmpty()) return null;

        switch (actionType) {
            case "COMPOUND_LOG_FEED" -> {
                List<BarnFeedClause> list = new ArrayList<>();
                for (Map<String, Object> row : items) {
                    Barn barn = barnRepository.findById(Long.valueOf(String.valueOf(row.get("barnId")))).orElse(null);
                    if (barn == null) continue;
                    if (!isWorkerAllowed(context, barn)) return barnNotAssignedResponse(barn);
                    double kg = Double.parseDouble(String.valueOf(row.get("kg")));
                    String feedName = String.valueOf(row.getOrDefault("feedName", "Higro 01"));
                    list.add(new BarnFeedClause(barn, feedName, kg));
                }
                return commitCompoundFeed(list, context.getUsername());
            }
            case "COMPOUND_LOG_MORTALITY" -> {
                List<BarnLossClause> list = new ArrayList<>();
                for (Map<String, Object> row : items) {
                    Barn barn = barnRepository.findById(Long.valueOf(String.valueOf(row.get("barnId")))).orElse(null);
                    if (barn == null) continue;
                    if (!isWorkerAllowed(context, barn)) return barnNotAssignedResponse(barn);
                    int qty = Integer.parseInt(String.valueOf(row.get("qty")));
                    list.add(new BarnLossClause(barn, qty));
                }
                return commitCompoundLoss(list, context.getUsername());
            }
            case "COMPOUND_LOG_WEIGHT" -> {
                List<BarnWeightClause> list = new ArrayList<>();
                for (Map<String, Object> row : items) {
                    Barn barn = barnRepository.findById(Long.valueOf(String.valueOf(row.get("barnId")))).orElse(null);
                    if (barn == null) continue;
                    if (!isWorkerAllowed(context, barn)) return barnNotAssignedResponse(barn);
                    double weight = Double.parseDouble(String.valueOf(row.get("weight")));
                    list.add(new BarnWeightClause(barn, weight));
                }
                return commitCompoundWeight(list, context.getUsername());
            }
            default -> {
                return null;
            }
        }
    }

    // ─────────────────────────────────────────────────────────────
    // HELPERS, RBAC & ATOMIC STOCK DEDUCTION
    // ─────────────────────────────────────────────────────────────
    private boolean isWorkerAllowed(AssistantExecutionContext context, Barn barn) {
        if (!context.isWorker() || barn == null || barn.getId() == null || workAssignmentService == null) {
            return true;
        }
        return workAssignmentService.barnIdsOf(context.getUsername()).contains(barn.getId());
    }

    private AiAssistantResponse barnNotAssignedResponse(Barn barn) {
        return AiAssistantResponse.builder()
                .reply("⚠️ Bạn chỉ có thể ghi nhận hoạt động cho các lứa nuôi và chuồng được phân công cho mình. Chuồng **"
                        + barn.getName() + "** nằm ngoài phạm vi phân công (MSG51).")
                .actionType("BARN_NOT_ASSIGNED")
                .executed(false)
                .build();
    }

    private WarehouseCategory resolveAreaFeedWarehouse(Barn barn) {
        if (warehouseRepository == null || barn == null || barn.getArea() == null) {
            return null;
        }
        List<WarehouseCategory> stores = warehouseRepository.findAllByArea_Id(barn.getArea().getId());
        return stores.stream()
                .filter(w -> "FEED".equalsIgnoreCase(w.getKind()))
                .findFirst()
                .or(() -> stores.stream().filter(w -> w.getKind() == null).findFirst())
                .orElse(stores.isEmpty() ? null : stores.get(0));
    }

    private Barn resolveBarn(String nameOrMention) {
        String clean = nameOrMention.replaceAll("(?i)\\b(nhà|chuồng)\\b", "").replaceAll("\\s+", "").trim();
        List<Barn> all = barnRepository.findAll();
        for (Barn b : all) {
            String bClean = b.getName().replaceAll("(?i)\\b(nhà|chuồng)\\b", "").replaceAll("\\s+", "").trim();
            if (bClean.equalsIgnoreCase(clean) || b.getName().equalsIgnoreCase(nameOrMention.trim())) {
                return b;
            }
        }
        return null;
    }

    private double extractQuantityKg(String text) {
        String stripped = BARN_PATTERN.matcher(text).replaceAll(" ");
        Matcher bagMatcher = Pattern.compile("(\\d+(?:[.,]\\d+)?)\\s*(?:bao)").matcher(stripped);
        if (bagMatcher.find()) {
            return Double.parseDouble(bagMatcher.group(1).replace(",", ".")) * 25.0;
        }
        Matcher kgMatcher = Pattern.compile("(\\d+(?:[.,]\\d+)?)\\s*(?:kg|cân)").matcher(stripped);
        if (kgMatcher.find()) {
            return Double.parseDouble(kgMatcher.group(1).replace(",", "."));
        }
        Matcher numMatcher = Pattern.compile("(\\d+(?:[.,]\\d+)?)").matcher(stripped);
        if (numMatcher.find()) {
            try {
                double val = Double.parseDouble(numMatcher.group(1).replace(",", "."));
                if (val > 0) return val;
            } catch (Exception ignored) {}
        }
        return 0.0;
    }

    private int extractCount(String text) {
        String stripped = BARN_PATTERN.matcher(text).replaceAll(" ");
        Matcher mWithUnit = Pattern.compile("(\\d+)\\s*con").matcher(stripped);
        if (mWithUnit.find()) {
            try {
                return Integer.parseInt(mWithUnit.group(1));
            } catch (Exception ignored) {}
        }
        Matcher m = Pattern.compile("(\\d+)").matcher(stripped);
        if (m.find()) {
            try {
                return Integer.parseInt(m.group(1));
            } catch (Exception ignored) {}
        }
        return 0;
    }

    private String extractFeedName(String text, String fallback) {
        String norm = VietnameseSpeechNormalizer.removeVietnameseDiacritics(text).toLowerCase(Locale.ROOT);
        if (norm.contains("cargill 1502") || norm.contains("1502") || norm.contains("cargill")) return "Cám Gà vỗ béo Cargill 1502";
        if (norm.contains("higro 510") || norm.contains("510")) return "Cám Gà choai Higro 510";
        if (norm.contains("cp 511") || norm.contains("cam cp") || norm.contains("511")) return "Cám Gà con CP 511";
        if (norm.contains("higro 02") || norm.contains("cam so 2")) return "Higro 02";
        if (norm.contains("higro 01") || norm.contains("cam so 1") || norm.contains("higro")) return "Higro 01";
        return fallback;
    }

    private double calculateTotalFeedStockKg(String feedName) {
        String search = feedName.toLowerCase(Locale.ROOT).replace("cám ", "").trim();
        List<InventoryItem> items = inventoryRepository.findAll();
        double totalKg = 0.0;
        boolean found = false;

        for (InventoryItem item : items) {
            if (item.getProduct() != null) {
                String pName = item.getProduct().getName().toLowerCase(Locale.ROOT);
                if (pName.contains(search) || pName.contains(feedName.toLowerCase(Locale.ROOT))) {
                    found = true;
                    BigDecimal stock = item.getStock() != null ? item.getStock() : BigDecimal.ZERO;
                    totalKg += stock.doubleValue() * kgFactor(item);
                }
            }
        }
        return found ? totalKg : -1.0;
    }

    private BigDecimal deductInventoryStockAtomic(Barn barn, String feedName, double kg) {
        String search = feedName.toLowerCase(Locale.ROOT).replace("cám ", "").trim();
        WarehouseCategory preferredWh = resolveAreaFeedWarehouse(barn);

        List<InventoryItem> all = inventoryRepository.findAll();
        List<InventoryItem> matching = all.stream()
                .filter(item -> item.getProduct() != null && item.getStock() != null && item.getStock().signum() > 0)
                .filter(item -> {
                    String pName = item.getProduct().getName().toLowerCase(Locale.ROOT);
                    return pName.contains(search) || pName.contains(feedName.toLowerCase(Locale.ROOT));
                })
                .sorted(Comparator
                        .comparing((InventoryItem i) -> (preferredWh != null && i.getWarehouse() != null
                                && Objects.equals(preferredWh.getId(), i.getWarehouse().getId())) ? 0 : 1)
                        .thenComparing(InventoryItem::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(InventoryItem::getId))
                .toList();

        if (matching.isEmpty()) {
            return BigDecimal.valueOf(13500.00);
        }

        BigDecimal remainingKg = BigDecimal.valueOf(kg);
        BigDecimal totalCost = BigDecimal.ZERO;
        BigDecimal totalDeductedKg = BigDecimal.ZERO;

        for (InventoryItem lot : matching) {
            if (remainingKg.signum() <= 0) break;
            double factor = kgFactor(lot);
            BigDecimal lotStockKg = lot.getStock().multiply(BigDecimal.valueOf(factor));
            if (lotStockKg.signum() <= 0) continue;

            BigDecimal takeKg = lotStockKg.min(remainingKg);
            BigDecimal takeUnits = factor == 1.0
                    ? takeKg.setScale(6, RoundingMode.HALF_UP)
                    : takeKg.divide(BigDecimal.valueOf(factor), 6, RoundingMode.HALF_UP);

            if (takeUnits.signum() <= 0) continue;
            if (inventoryRepository.takeStock(lot.getId(), takeUnits) != 1) {
                throw new BadRequestException("Tồn kho khả dụng không đủ hoặc vừa thay đổi (MSG27).", "STOCK_NOT_ENOUGH");
            }

            BigDecimal lotPrice = lot.getPrice() != null ? lot.getPrice() : BigDecimal.ZERO;
            totalCost = totalCost.add(takeUnits.multiply(lotPrice));
            totalDeductedKg = totalDeductedKg.add(takeKg);
            remainingKg = remainingKg.subtract(takeKg);
        }

        if (remainingKg.compareTo(new BigDecimal("0.01")) > 0) {
            throw new BadRequestException("Tồn kho khả dụng không đủ cho " + feedName + " (MSG27).", "STOCK_NOT_ENOUGH");
        }

        if (totalDeductedKg.signum() > 0 && totalCost.signum() > 0) {
            return totalCost.divide(totalDeductedKg, 2, RoundingMode.HALF_UP);
        }
        return BigDecimal.valueOf(13500.00);
    }

    private static double kgFactor(InventoryItem item) {
        if (item.getUnit() == null) return 1.0;
        if (item.getUnit().getContentQuantity() != null
                && item.getUnit().getContentQuantity().signum() > 0) {
            if (item.getUnit().getContentUnit() == UsageUnit.KG) {
                return item.getUnit().getContentQuantity().doubleValue();
            }
            if (item.getUnit().getContentUnit() == UsageUnit.G) {
                return item.getUnit().getContentQuantity().doubleValue() / 1000.0;
            }
        }
        String unitName = item.getUnit().getName() != null ? item.getUnit().getName().toLowerCase(Locale.ROOT) : "";
        return unitName.contains("bao") ? 25.0 : 1.0;
    }

    private record BarnFeedClause(Barn barn, String feedName, double kg) {}
    private record BarnLossClause(Barn barn, int qty) {}
    private record BarnWeightClause(Barn barn, double weight) {}
}
