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

            Double parsedKg = extractSignedQuantityKg(clause);
            if (parsedKg == null) continue;
            if (parsedKg <= 0) {
                return validationErrorResponse("⚠️ Số lượng cám phải lớn hơn 0 (không được bằng 0 hoặc số âm). Vui lòng kiểm tra lại.");
            }
            double kg = parsedKg;

            String clauseFeed = extractFeedName(clause, defaultFeedName);
            feedClauses.add(new BarnFeedClause(barn, clauseFeed, kg));
            totalRequestedKg += kg;
        }

        if (feedClauses.isEmpty()) {
            return null;
        }

        // Pre-flight stock validation (MSG27) per feed & warehouse scope
        Map<String, Double> groupedRequestedKg = new LinkedHashMap<>();
        Map<String, Barn> groupedSampleBarn = new LinkedHashMap<>();
        Map<String, String> groupedFeedName = new LinkedHashMap<>();
        for (BarnFeedClause fc : feedClauses) {
            WarehouseCategory wh = resolveAreaFeedWarehouse(fc.barn);
            String scopeKey = (wh != null ? "WH_" + wh.getId() : (fc.barn.getArea() != null ? "AREA_" + fc.barn.getArea().getId() : "GLOBAL"))
                    + "::" + fc.feedName.toLowerCase(Locale.ROOT);
            groupedRequestedKg.merge(scopeKey, fc.kg, Double::sum);
            groupedSampleBarn.putIfAbsent(scopeKey, fc.barn);
            groupedFeedName.putIfAbsent(scopeKey, fc.feedName);
        }
        for (Map.Entry<String, Double> entry : groupedRequestedKg.entrySet()) {
            String scopeKey = entry.getKey();
            double groupRequested = entry.getValue();
            double availableStockKg = calculateTotalFeedStockKg(groupedSampleBarn.get(scopeKey), groupedFeedName.get(scopeKey));
            if (availableStockKg >= 0 && groupRequested > availableStockKg) {
                String availableFormatted = String.format(Locale.ROOT, "%.1f kg", availableStockKg);
                String requestedFormatted = String.format(Locale.ROOT, "%.1f kg", groupRequested);
                return AiAssistantResponse.builder()
                        .reply("⚠️ Tồn kho khả dụng không đủ cho **" + groupedFeedName.get(scopeKey) + "**. Giao dịch này sẽ làm cho số dư tồn kho bị âm (Hiện có: "
                                + availableFormatted + ", Yêu cầu: " + requestedFormatted + "). Vui lòng kiểm tra lại.")
                        .actionType("STOCK_INSUFFICIENT")
                        .executed(false)
                        .build();
            }
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
        List<String> savedParts = new ArrayList<>();
        List<String> skippedBarns = new ArrayList<>();
        BigDecimal totalRequestedKg = BigDecimal.ZERO;
        LocalDate today = LocalDate.now(CycleService.VN_ZONE);

        for (BarnFeedClause fc : feedClauses) {
            Barn barn = fc.barn;
            double kg = fc.kg;
            String feedName = fc.feedName;

            FarmingCycle cycle = cycleRepository.findFirstByBarnIdAndStatus(barn.getId(), CycleStatus.ACTIVE)
                    .orElse(null);

            if (cycle == null) {
                skippedBarns.add(barn.getName());
                continue;
            }

            BigDecimal unitPricePerKg;
            try {
                unitPricePerKg = deductInventoryStockAtomic(barn, feedName, kg);
            } catch (BadRequestException ex) {
                if (org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive()) {
                    org.springframework.transaction.interceptor.TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();
                }
                return AiAssistantResponse.builder()
                        .reply("⚠️ " + ex.getMessage())
                        .actionType("STOCK_INSUFFICIENT")
                        .executed(false)
                        .build();
            }

            FeedRecord record = new FeedRecord();
            record.setCycle(cycle);
            record.setRecordDate(today);
            record.setFeedName(feedName);
            record.setQuantityKg(BigDecimal.valueOf(kg).setScale(3, RoundingMode.HALF_UP));
            record.setUnitPrice(unitPricePerKg);
            record.setNote("Ghi hàng loạt qua Trợ lý Giọng nói FarmShift AI");
            record.setCreatedBy(username != null ? username : "Trợ lý AI");
            feedRepository.save(record);

            totalRequestedKg = totalRequestedKg.add(BigDecimal.valueOf(kg));
            savedParts.add("**" + barn.getName() + "** (" + String.format(Locale.ROOT, "%.1f kg", kg) + ")");

            Map<String, Object> itemSummary = new LinkedHashMap<>();
            itemSummary.put("barnName", barn.getName());
            itemSummary.put("feedName", feedName);
            itemSummary.put("kg", String.valueOf(kg));
            summaryList.add(itemSummary);
        }

        if (summaryList.isEmpty()) {
            return validationErrorResponse("⚠️ Không có chuồng nào trong yêu cầu đang có lứa nuôi hoạt động (`ACTIVE`) để ghi nhận cám.");
        }

        StringBuilder replyBuilder = new StringBuilder("✅ Đã ghi nhận nhật ký cám thành công cho ")
                .append(summaryList.size()).append(" chuồng: ")
                .append(String.join(", ", savedParts))
                .append(". Hệ số FCR và kho cám đã được cập nhật đồng bộ.");
        if (!skippedBarns.isEmpty()) {
            replyBuilder.append(" *(Bỏ qua chuồng chưa có lứa ACTIVE: ").append(String.join(", ", skippedBarns)).append(")*");
        }

        Map<String, Object> actionSummary = new LinkedHashMap<>();
        actionSummary.put("title", "Đã ghi nhận cám hàng loạt (" + summaryList.size() + " chuồng)");
        actionSummary.put("totalKg", totalRequestedKg.stripTrailingZeros().toPlainString());
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

            Integer parsedQty = extractSignedCount(clause);
            if (parsedQty == null) continue;
            if (parsedQty <= 0) {
                return validationErrorResponse("⚠️ Số lượng hao hụt phải lớn hơn 0 (không được bằng 0 hoặc số âm). Vui lòng kiểm tra lại.");
            }
            int qty = parsedQty;
            if (qty > barn.getCurrentQuantity()) {
                return validationErrorResponse("⚠️ Số lượng hao hụt (**" + qty + " con**) vượt quá số gà hiện nuôi tại **"
                        + barn.getName() + "** (" + barn.getCurrentQuantity() + " con, MSG25).");
            }

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
        List<String> savedParts = new ArrayList<>();
        List<String> skippedBarns = new ArrayList<>();
        List<Map<String, Object>> summaryList = new ArrayList<>();
        int totalLoss = 0;
        LocalDate today = LocalDate.now(CycleService.VN_ZONE);

        for (BarnLossClause lc : lossClauses) {
            Barn barn = lc.barn;
            int qty = lc.qty;
            if (qty > barn.getCurrentQuantity()) {
                return validationErrorResponse("⚠️ Số lượng hao hụt (**" + qty + " con**) vượt quá số gà hiện nuôi tại **"
                        + barn.getName() + "** (" + barn.getCurrentQuantity() + " con, MSG25).");
            }

            FarmingCycle cycle = cycleRepository.findFirstByBarnIdAndStatus(barn.getId(), CycleStatus.ACTIVE).orElse(null);
            Flock flock = cycle == null ? null : flockRepository.findAllByCycleIdOrderByImportDateAscIdAsc(cycle.getId())
                    .stream().filter(f -> f.getStatus() == FlockStatus.ACTIVE).findFirst().orElse(null);

            if (cycle == null || flock == null) {
                skippedBarns.add(barn.getName());
                continue;
            }

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

            barn.setCurrentQuantity(Math.max(0, barn.getCurrentQuantity() - qty));
            barnRepository.save(barn);

            totalLoss += qty;
            savedParts.add(barn.getName() + " (" + qty + " con)");

            Map<String, Object> itemMap = new LinkedHashMap<>();
            itemMap.put("barnName", barn.getName());
            itemMap.put("quantity", qty);
            summaryList.add(itemMap);
        }

        if (summaryList.isEmpty()) {
            return validationErrorResponse("⚠️ Không có chuồng nào đang có đàn/lứa nuôi hoạt động (`ACTIVE`) để ghi nhận hao hụt.");
        }

        StringBuilder replyBuilder = new StringBuilder("✅ Đã ghi nhận hao hụt thành công: ")
                .append(String.join(", ", savedParts))
                .append(". Đàn gà đã được cập nhật số lượng sống.");
        if (!skippedBarns.isEmpty()) {
            replyBuilder.append(" *(Bỏ qua chuồng chưa có đàn ACTIVE: ").append(String.join(", ", skippedBarns)).append(")*");
        }

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

            Double parsedWeight = extractSignedQuantityKg(clause);
            if (parsedWeight == null) continue;
            if (parsedWeight <= 0) {
                return validationErrorResponse("⚠️ Trọng lượng cân mẫu phải lớn hơn 0 (không được bằng 0 hoặc số âm). Vui lòng kiểm tra lại.");
            }
            double weight = parsedWeight;

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
        List<String> savedParts = new ArrayList<>();
        List<String> skippedBarns = new ArrayList<>();
        List<Map<String, Object>> summaryList = new ArrayList<>();
        LocalDate today = LocalDate.now(CycleService.VN_ZONE);

        for (BarnWeightClause wc : weightClauses) {
            FarmingCycle cycle = cycleRepository.findFirstByBarnIdAndStatus(wc.barn.getId(), CycleStatus.ACTIVE).orElse(null);
            if (cycle == null) {
                skippedBarns.add(wc.barn.getName());
                continue;
            }
            WeightSample ws = new WeightSample();
            ws.setCycle(cycle);
            ws.setSampleDate(today);
            ws.setAvgWeightKg(BigDecimal.valueOf(wc.weight));
            ws.setSampleSize(50);
            ws.setNote("Cân mẫu ghi hàng loạt qua AI");
            ws.setCreatedBy(username != null ? username : "Trợ lý AI");
            weightRepository.save(ws);

            savedParts.add("**" + wc.barn.getName() + "** (" + String.format(Locale.ROOT, "%.2f kg", wc.weight) + ")");

            Map<String, Object> map = new LinkedHashMap<>();
            map.put("barnName", wc.barn.getName());
            map.put("avgWeight", wc.weight);
            summaryList.add(map);
        }

        if (summaryList.isEmpty()) {
            return validationErrorResponse("⚠️ Không có chuồng nào trong yêu cầu đang có lứa nuôi hoạt động (`ACTIVE`) để ghi cân mẫu.");
        }

        StringBuilder replyBuilder = new StringBuilder("✅ Đã ghi nhận cân mẫu trọng lượng cho: ")
                .append(String.join(", ", savedParts))
                .append(". Chỉ số tăng trọng ADG đã được tính toán.");
        if (!skippedBarns.isEmpty()) {
            replyBuilder.append(" *(Bỏ qua chuồng chưa có lứa ACTIVE: ").append(String.join(", ", skippedBarns)).append(")*");
        }

        Map<String, Object> actionSummary = new LinkedHashMap<>();
        actionSummary.put("title", "Cân mẫu hàng loạt (" + summaryList.size() + " chuồng)");
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

    private AiAssistantResponse validationErrorResponse(String message) {
        return AiAssistantResponse.builder()
                .reply(message)
                .actionType("VALIDATION_ERROR")
                .executed(false)
                .requiresConfirmation(false)
                .build();
    }

    private Double extractSignedQuantityKg(String text) {
        String stripped = VietnameseSpeechNormalizer.removeVietnameseDiacritics(
                BARN_PATTERN.matcher(text).replaceAll(" ")
        ).toLowerCase(Locale.ROOT);
        Matcher bagMatcher = Pattern.compile("(?<![\\p{L}\\d.])(-\\s*|\\bam\\s+)?(\\d+(?:[.,]\\d+)?)\\s*bao\\b").matcher(stripped);
        if (bagMatcher.find()) {
            double val = Double.parseDouble(bagMatcher.group(2).replace(",", ".")) * 25.0;
            return bagMatcher.group(1) != null ? -val : val;
        }
        Matcher kgMatcher = Pattern.compile("(?<![\\p{L}\\d.])(-\\s*|\\bam\\s+)?(\\d+(?:[.,]\\d+)?)\\s*(?:kg|ki|ky|can|kilogram)\\b").matcher(stripped);
        if (kgMatcher.find()) {
            double val = Double.parseDouble(kgMatcher.group(2).replace(",", "."));
            return kgMatcher.group(1) != null ? -val : val;
        }
        Matcher numMatcher = Pattern.compile("(?<![\\p{L}\\d.])(-\\s*|\\bam\\s+)?(\\d+(?:[.,]\\d+)?)\\b").matcher(stripped);
        if (numMatcher.find()) {
            try {
                double val = Double.parseDouble(numMatcher.group(2).replace(",", "."));
                return numMatcher.group(1) != null ? -val : val;
            } catch (Exception ignored) {}
        }
        return null;
    }

    private Integer extractSignedCount(String text) {
        String stripped = VietnameseSpeechNormalizer.removeVietnameseDiacritics(
                BARN_PATTERN.matcher(text).replaceAll(" ")
        ).toLowerCase(Locale.ROOT);
        Matcher mWithUnit = Pattern.compile("(?<![\\p{L}\\d.])(-\\s*|\\bam\\s+)?(\\d+)\\s*con\\b").matcher(stripped);
        if (mWithUnit.find()) {
            try {
                int val = Integer.parseInt(mWithUnit.group(2));
                return mWithUnit.group(1) != null ? -val : val;
            } catch (Exception ignored) {}
        }
        Matcher m = Pattern.compile("(?<![\\p{L}\\d.])(-\\s*|\\bam\\s+)?(\\d+)\\b").matcher(stripped);
        if (m.find()) {
            try {
                int val = Integer.parseInt(m.group(2));
                return m.group(1) != null ? -val : val;
            } catch (Exception ignored) {}
        }
        return null;
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

    private List<InventoryItem> resolveScopedFeedLots(Barn barn, String feedName, boolean positiveStockOnly) {
        String search = feedName.toLowerCase(Locale.ROOT).replace("cám ", "").trim();
        WarehouseCategory preferredWh = resolveAreaFeedWarehouse(barn);
        Long barnAreaId = barn != null && barn.getArea() != null ? barn.getArea().getId() : null;

        List<InventoryItem> matching = inventoryRepository.findAll().stream()
                .filter(item -> item.getProduct() != null && (!positiveStockOnly || (item.getStock() != null && item.getStock().signum() > 0)))
                .filter(item -> {
                    String pName = item.getProduct().getName().toLowerCase(Locale.ROOT);
                    return pName.contains(search) || pName.contains(feedName.toLowerCase(Locale.ROOT));
                })
                // Never pull stock from another farm area's dedicated warehouse
                .filter(item -> barnAreaId == null
                        || item.getWarehouse() == null
                        || item.getWarehouse().getArea() == null
                        || Objects.equals(item.getWarehouse().getArea().getId(), barnAreaId))
                .toList();

        if (preferredWh != null) {
            List<InventoryItem> inAreaWh = matching.stream()
                    .filter(i -> i.getWarehouse() != null && Objects.equals(preferredWh.getId(), i.getWarehouse().getId()))
                    .toList();
            if (!inAreaWh.isEmpty()) {
                matching = inAreaWh;
            }
        }

        return matching.stream()
                .sorted(Comparator
                        .comparing(InventoryItem::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(InventoryItem::getId))
                .toList();
    }

    private double calculateTotalFeedStockKg(Barn barn, String feedName) {
        List<InventoryItem> scoped = resolveScopedFeedLots(barn, feedName, false);
        if (scoped.isEmpty()) {
            return -1.0;
        }
        BigDecimal totalKg = BigDecimal.ZERO;
        for (InventoryItem item : scoped) {
            BigDecimal stock = item.getStock() != null ? item.getStock() : BigDecimal.ZERO;
            BigDecimal factor = BigDecimal.valueOf(kgFactor(item));
            totalKg = totalKg.add(stock.multiply(factor));
        }
        return totalKg.doubleValue();
    }

    private BigDecimal deductInventoryStockAtomic(Barn barn, String feedName, double kg) {
        List<InventoryItem> allScoped = resolveScopedFeedLots(barn, feedName, false);
        if (allScoped.isEmpty()) {
            return BigDecimal.valueOf(13500.00);
        }
        List<InventoryItem> matching = allScoped.stream()
                .filter(item -> item.getStock() != null && item.getStock().signum() > 0)
                .toList();
        if (matching.isEmpty()) {
            throw new BadRequestException("Tồn kho khả dụng cho " + feedName + " đã hết (MSG27).", "STOCK_NOT_ENOUGH");
        }

        BigDecimal remainingKg = BigDecimal.valueOf(kg);
        BigDecimal totalAvailableKg = BigDecimal.ZERO;
        for (InventoryItem lot : matching) {
            totalAvailableKg = totalAvailableKg.add(lot.getStock().multiply(BigDecimal.valueOf(kgFactor(lot))));
        }
        if (totalAvailableKg.add(new BigDecimal("0.01")).compareTo(remainingKg) < 0) {
            throw new BadRequestException("Tồn kho khả dụng không đủ cho " + feedName + " (MSG27).", "STOCK_NOT_ENOUGH");
        }

        BigDecimal totalCost = BigDecimal.ZERO;
        BigDecimal totalDeductedKg = BigDecimal.ZERO;
        List<Map.Entry<Long, BigDecimal>> deductedLots = new ArrayList<>();

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
                for (Map.Entry<Long, BigDecimal> prev : deductedLots) {
                    inventoryRepository.returnStock(prev.getKey(), prev.getValue());
                }
                throw new BadRequestException("Tồn kho khả dụng không đủ hoặc vừa thay đổi (MSG27).", "STOCK_NOT_ENOUGH");
            }
            deductedLots.add(Map.entry(lot.getId(), takeUnits));

            BigDecimal lotPrice = lot.getPrice() != null ? lot.getPrice() : BigDecimal.ZERO;
            totalCost = totalCost.add(takeUnits.multiply(lotPrice));
            totalDeductedKg = totalDeductedKg.add(takeKg);
            remainingKg = remainingKg.subtract(takeKg);
        }

        if (remainingKg.compareTo(new BigDecimal("0.01")) > 0) {
            for (Map.Entry<Long, BigDecimal> prev : deductedLots) {
                inventoryRepository.returnStock(prev.getKey(), prev.getValue());
            }
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
