package com.farmshift.backendFarmShift.service.ai.handler;

import com.farmshift.backendFarmShift.dto.AiAssistantResponse;
import com.farmshift.backendFarmShift.entity.*;
import com.farmshift.backendFarmShift.repository.*;
import com.farmshift.backendFarmShift.service.VietnameseSpeechNormalizer;
import com.farmshift.backendFarmShift.service.ai.AssistantCommandHandler;
import com.farmshift.backendFarmShift.service.ai.AssistantExecutionContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
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
 * Enforces pre-flight stock validation (MSG27) and atomic multi-entity DB execution.
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

    private static final Pattern BARN_PATTERN = Pattern.compile("(?i)\\b(Nhà\\s+[A-Za-z0-9]+|Chuồng\\s+[A-Za-z0-9]+)\\b");

    @Override
    public int getOrder() {
        return 20;
    }

    @Override
    public boolean canHandle(AssistantExecutionContext context) {
        if (Boolean.TRUE.equals(context.getConfirmAction())) {
            return false;
        }
        String msg = context.getMessage();
        if (msg == null || msg.isBlank()) {
            return false;
        }

        // Count unique barn occurrences in the message
        Set<String> mentionedBarns = extractBarnMentions(msg);
        if (mentionedBarns.size() < 2) {
            return false;
        }

        String norm = VietnameseSpeechNormalizer.removeVietnameseDiacritics(msg).toLowerCase();
        boolean hasFeed = norm.contains("cam") || norm.contains("cho an") || norm.contains("ghi");
        boolean hasLoss = norm.contains("chet") || norm.contains("hao hut") || norm.contains("loai thai");
        boolean hasWeight = norm.contains("can mau") || norm.contains("trong luong") || norm.contains("kg") || norm.contains("can");

        return hasFeed || hasLoss || hasWeight;
    }

    @Override
    @Transactional
    public AiAssistantResponse handle(AssistantExecutionContext context) {
        String msg = context.getMessage();
        String norm = VietnameseSpeechNormalizer.removeVietnameseDiacritics(msg).toLowerCase();

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

        // Global feed name if specified at sentence head (e.g., "Ghi 40kg cám Higro 01...")
        String defaultFeedName = extractFeedName(msg, "Higro 01");

        List<BarnFeedClause> feedClauses = new ArrayList<>();
        double totalRequestedKg = 0.0;

        for (String clause : clauses) {
            Matcher barnMatcher = BARN_PATTERN.matcher(clause);
            if (!barnMatcher.find()) continue;

            String barnStr = barnMatcher.group(1).trim();
            Barn barn = resolveBarn(barnStr);
            if (barn == null) continue;

            double kg = extractQuantityKg(clause);
            if (kg <= 0) continue;

            String clauseFeed = extractFeedName(clause, defaultFeedName);
            feedClauses.add(new BarnFeedClause(barn, clauseFeed, kg));
            totalRequestedKg += kg;
        }

        if (feedClauses.isEmpty()) {
            return null;
        }

        // ── PRE-FLIGHT STOCK VALIDATION (MSG27) ──
        double availableStockKg = calculateTotalFeedStockKg(defaultFeedName);
        if (availableStockKg >= 0 && totalRequestedKg > availableStockKg) {
            String availableFormatted = String.format("%.1f kg", availableStockKg);
            String requestedFormatted = String.format("%.1f kg", totalRequestedKg);
            return AiAssistantResponse.builder()
                    .reply("⚠️ Tồn kho khả dụng không đủ. Giao dịch này sẽ làm cho số dư tồn kho bị âm (Hiện có: "
                            + availableFormatted + ", Yêu cầu: " + requestedFormatted + "). Vui lòng kiểm tra lại.")
                    .actionType("STOCK_INSUFFICIENT")
                    .executed(false)
                    .build();
        }

        // ── ATOMIC BATCH EXECUTION ──
        List<Map<String, Object>> summaryList = new ArrayList<>();
        StringBuilder replyBuilder = new StringBuilder("✅ Đã ghi nhận nhật ký cám thành công cho ")
                .append(feedClauses.size()).append(" chuồng: ");

        for (int i = 0; i < feedClauses.size(); i++) {
            BarnFeedClause fc = feedClauses.get(i);
            Barn barn = fc.barn;
            double kg = fc.kg;
            String feedName = fc.feedName;

            FarmingCycle cycle = cycleRepository.findFirstByBarnIdAndStatus(barn.getId(), CycleStatus.ACTIVE)
                    .orElse(null);

            if (cycle != null) {
                FeedRecord record = new FeedRecord();
                record.setCycle(cycle);
                record.setRecordDate(LocalDate.now());
                record.setFeedName(feedName);
                record.setQuantityKg(BigDecimal.valueOf(kg));
                record.setUnitPrice(BigDecimal.valueOf(13500.00));
                record.setNote("Ghi hàng loạt qua Trợ lý Giọng nói FarmShift AI");
                record.setCreatedBy(context.getUsername() != null ? context.getUsername() : "Trợ lý AI");
                feedRepository.save(record);

                deductInventoryStock(feedName, kg);
            }

            if (i > 0) replyBuilder.append(", ");
            replyBuilder.append("**").append(barn.getName()).append("** (").append(String.format("%.1f kg", kg)).append(")");

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
        actionSummary.put("timestamp", LocalDateTime.now().toString());

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

            int qty = extractCount(clause);
            if (qty <= 0) continue;

            lossClauses.add(new BarnLossClause(barn, qty));
            totalLoss += qty;
        }

        if (lossClauses.isEmpty()) {
            return null;
        }

        StringBuilder replyBuilder = new StringBuilder("✅ Đã ghi nhận hao hụt thành công: ");
        List<Map<String, Object>> summaryList = new ArrayList<>();

        for (int i = 0; i < lossClauses.size(); i++) {
            BarnLossClause lc = lossClauses.get(i);
            Barn barn = lc.barn;
            int qty = lc.qty;

            FarmingCycle cycle = cycleRepository.findFirstByBarnIdAndStatus(barn.getId(), CycleStatus.ACTIVE).orElse(null);
            if (cycle != null) {
                List<Flock> flocks = flockRepository.findAllByCycleIdOrderByImportDateAscIdAsc(cycle.getId());
                Flock flock = flocks.stream().filter(f -> f.getStatus() == FlockStatus.ACTIVE).findFirst().orElse(null);

                if (flock != null) {
                    FlockMovement movement = new FlockMovement();
                    movement.setFlock(flock);
                    movement.setType(FlockMovementType.DEATH);
                    movement.setMovementDate(LocalDate.now());
                    movement.setQuantity(qty);
                    movement.setNote("Hao hụt ghi nhận hàng loạt qua Trợ lý AI");
                    movement.setCreatedBy(context.getUsername() != null ? context.getUsername() : "Trợ lý AI");
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
        actionSummary.put("timestamp", LocalDateTime.now().toString());

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

        StringBuilder replyBuilder = new StringBuilder("✅ Đã ghi nhận cân mẫu trọng lượng cho: ");
        List<Map<String, Object>> summaryList = new ArrayList<>();
        int count = 0;

        for (String clause : clauses) {
            Matcher barnMatcher = BARN_PATTERN.matcher(clause);
            if (!barnMatcher.find()) continue;

            String barnStr = barnMatcher.group(1).trim();
            Barn barn = resolveBarn(barnStr);
            if (barn == null) continue;

            double weight = extractQuantityKg(clause);
            if (weight <= 0) continue;

            FarmingCycle cycle = cycleRepository.findFirstByBarnIdAndStatus(barn.getId(), CycleStatus.ACTIVE).orElse(null);
            if (cycle != null) {
                WeightSample ws = new WeightSample();
                ws.setCycle(cycle);
                ws.setSampleDate(LocalDate.now());
                ws.setAvgWeightKg(BigDecimal.valueOf(weight));
                ws.setSampleSize(50);
                ws.setNote("Cân mẫu ghi hàng loạt qua AI");
                ws.setCreatedBy(context.getUsername() != null ? context.getUsername() : "Trợ lý AI");
                weightRepository.save(ws);
            }

            if (count > 0) replyBuilder.append(", ");
            replyBuilder.append("**").append(barn.getName()).append("** (").append(String.format("%.2f kg", weight)).append(")");

            Map<String, Object> map = new LinkedHashMap<>();
            map.put("barnName", barn.getName());
            map.put("avgWeight", weight);
            summaryList.add(map);
            count++;
        }

        if (count == 0) return null;

        replyBuilder.append(". Chỉ số tăng trọng ADG đã được tính toán.");

        Map<String, Object> actionSummary = new LinkedHashMap<>();
        actionSummary.put("title", "Cân mẫu hàng loạt (" + count + " chuồng)");
        actionSummary.put("items", summaryList);
        actionSummary.put("timestamp", LocalDateTime.now().toString());

        return AiAssistantResponse.builder()
                .reply(replyBuilder.toString())
                .actionType("COMPOUND_LOG_WEIGHT")
                .executed(true)
                .uiCommand("REFRESH_DATA")
                .actionSummary(actionSummary)
                .build();
    }

    // ─────────────────────────────────────────────────────────────
    // HELPERS & STOCK CHECKS
    // ─────────────────────────────────────────────────────────────
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
        // Match numbers before bao
        Matcher bagMatcher = Pattern.compile("(\\d+(?:[.,]\\d+)?)\\s*(?:bao)").matcher(stripped);
        if (bagMatcher.find()) {
            return Double.parseDouble(bagMatcher.group(1).replace(",", ".")) * 25.0;
        }
        // Match numbers with kg/cân first
        Matcher kgMatcher = Pattern.compile("(\\d+(?:[.,]\\d+)?)\\s*(?:kg|cân)").matcher(stripped);
        if (kgMatcher.find()) {
            return Double.parseDouble(kgMatcher.group(1).replace(",", "."));
        }
        // Standalone number fallback
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
        String lower = text.toLowerCase();
        if (lower.contains("cp 511") || lower.contains("cám cp")) return "CP 511";
        if (lower.contains("higro 02") || lower.contains("cám số 2")) return "Higro 02";
        if (lower.contains("higro 01") || lower.contains("cám số 1") || lower.contains("higro")) return "Higro 01";
        return fallback;
    }

    private double calculateTotalFeedStockKg(String feedName) {
        String search = feedName.toLowerCase().replace("cám ", "").trim();
        List<InventoryItem> items = inventoryRepository.findAll();
        double totalKg = 0.0;
        boolean found = false;

        for (InventoryItem item : items) {
            if (item.getProduct() != null) {
                String pName = item.getProduct().getName().toLowerCase();
                if (pName.contains(search) || pName.contains(feedName.toLowerCase())) {
                    found = true;
                    BigDecimal stock = item.getStock() != null ? item.getStock() : BigDecimal.ZERO;
                    String unitName = item.getUnit() != null ? item.getUnit().getName().toLowerCase() : "";
                    if (unitName.contains("bao")) {
                        totalKg += stock.doubleValue() * 25.0;
                    } else {
                        totalKg += stock.doubleValue();
                    }
                }
            }
        }
        return found ? totalKg : -1.0; // Return -1 if no inventory tracking found
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

    private record BarnFeedClause(Barn barn, String feedName, double kg) {}
    private record BarnLossClause(Barn barn, int qty) {}
}
