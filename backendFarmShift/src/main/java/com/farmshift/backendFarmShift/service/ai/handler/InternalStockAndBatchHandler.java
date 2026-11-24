package com.farmshift.backendFarmShift.service.ai.handler;

import com.farmshift.backendFarmShift.dto.AiAssistantResponse;
import com.farmshift.backendFarmShift.dto.request.InternalStockVoucherItemRequest;
import com.farmshift.backendFarmShift.dto.request.InternalStockVoucherRequest;
import com.farmshift.backendFarmShift.entity.*;
import com.farmshift.backendFarmShift.repository.*;
import com.farmshift.backendFarmShift.service.CycleService;
import com.farmshift.backendFarmShift.service.InternalStockService;
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
import java.text.NumberFormat;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Handles Internal Stock Movements & Batch-Price (#<date><time>) AI skills:
 * 1. Batch-Level Inventory & Price Inquiry (Weighted Average Price + Lots + RBAC Price Masking).
 * 2. Voice/Chat Internal Stock Vouchers (Disposal / EXPORT, Transfer / TRANSFER) with 2-step PendingActionCard.
 */
@Slf4j
@Component
@Order(30)
@RequiredArgsConstructor
public class InternalStockAndBatchHandler implements AssistantCommandHandler {

    private final InventoryItemRepository inventoryRepository;
    private final WarehouseCategoryRepository warehouseRepository;
    private final ProductCategoryRepository productCategoryRepository;
    private final InternalStockCategoryRepository internalStockCategoryRepository;
    private final InternalStockService internalStockService;

    @Autowired(required = false)
    private WorkAssignmentService workAssignmentService;

    @Autowired(required = false)
    private BarnRepository barnRepository;

    @Autowired(required = false)
    private FarmAreaRepository farmAreaRepository;

    private static final DateTimeFormatter BATCH_CODE_FORMATTER = DateTimeFormatter.ofPattern("yyyyMMdd-HHmm");
    private static final ThreadLocal<NumberFormat> CURRENCY_FORMAT =
            ThreadLocal.withInitial(() -> NumberFormat.getInstance(Locale.forLanguageTag("vi-VN")));

    private static String formatCurrency(Object value) {
        return CURRENCY_FORMAT.get().format(value);
    }

    @Override
    public int getOrder() {
        return 30;
    }

    private static final Pattern WORD_BOUNDARY_HUY = Pattern.compile(
            "\\b(?:xuat\\s+huy|xuat\\s+kho\\s+huy|tieu\\s+huy|huy\\s+lo|huy\\s+cam|huy\\s+hang|huy\\s+kho|bo\\s+di)\\b"
    );
    private static final Pattern EXCLUDED_HUY_COMPOUNDS = Pattern.compile("\\b(?:phat\\s+huy|huy\\s+dong|chi\\s+huy|huy\\s+chuong)\\b");
    private static final Pattern TRANSFER_EXPLICIT_PATTERN = Pattern.compile(
            "\\b(?:chuyen\\s+kho|dieu\\s+chuyen\\s+kho|xuat\\s+chuyen\\s+kho|xuat\\s+noi\\s+bo|phieu\\s+chuyen\\s+kho)\\b"
                    + "|\\b(?:chuyen|dieu\\s+chuyen)\\b.{0,80}\\b(?:tu\\s+kho\\b|(?:sang|den|qua|ve)\\s+(?:chinh\\s+)?kho\\b|giua\\s+(?:\\d+|hai)\\s+kho\\b|giua\\s+cac\\s+kho\\b)"
                    + "|\\b(?:chuyen|dieu\\s+chuyen)\\s+(?:-\\s*|am\\s+)?\\d+(?:[.,]\\d+)?\\s*(?:bao|kg|ki|ky|lo|chai|goi|thung|don\\s+vi)\\s+(?:cam|thuc\\s+an|thuoc|vac[\\s-]?xin|vat\\s+tu)\\b"
    );
    private static final Pattern FLOCK_OR_NAV_EXCLUSION_PATTERN = Pattern.compile(
            "\\b(?:chuyen\\s+dan|tach\\s+dan|con\\s+ga|nha\\s+[abcd]?\\d+|chuong\\s+[abcd]?\\d+|man\\s+hinh|trang\\s+(?:hoa\\s+don|nhap|ban|bao\\s+cao|nhat\\s+ky|chuong|kho))\\b"
    );
    private static final Pattern ARTICLE_FOOTER_OR_PROSE_PATTERN = Pattern.compile(
            "(?:phat\\s+hanh\\s+lai\\s+thong\\s+tin|website\\s+nay|ban\\s+quyen\\s+thuoc\\s+ve|theo\\s+phong\\s+vien|ban\\s+bien\\s+tap|nguon\\s+tin|doc\\s+them\\s+tai|https?://|www\\.)"
    );
    private static final Set<String> KNOWN_PRODUCT_KEYWORDS = Set.of(
            "higro", "cargill", "cp 511", "cp 512", "dabaco", "h5n1", "lasota", "gumboro",
            "marek", "bio-zyme", "biozyme", "han-coc", "toltrazuril", "bkc", "doxycycline", "tylosin",
            "enrofloxacin", "amoxicillin", "paracetamol", "gluco", "electrolytes"
    );

    private static boolean isLikelyPastedArticleOrNonCommand(String norm, String rawMessage) {
        if (norm == null || norm.isBlank()) {
            return true;
        }
        if (ARTICLE_FOOTER_OR_PROSE_PATTERN.matcher(norm).find()) {
            return true;
        }
        boolean startsWithDirectStockVerb = norm.matches(
                "^(?:xuat\\s+huy|xuat\\s+kho\\s+huy|tieu\\s+huy|huy\\s+lo|huy\\s+cam|huy\\s+hang|huy\\s+kho|chuyen\\s+kho|dieu\\s+chuyen|tao\\s+phieu\\s+(?:xuat|chuyen)|trong\\s+kho|kiem\\s+tra\\s+ton|ton\\s+kho).*"
        );
        return rawMessage != null && rawMessage.length() > 220 && !startsWithDirectStockVerb;
    }

    private static boolean isInternalStockMovementIntent(String norm) {
        if (norm == null || norm.isBlank()) {
            return false;
        }
        String scrubbed = EXCLUDED_HUY_COMPOUNDS.matcher(norm).replaceAll(" ");
        boolean isDisposal = WORD_BOUNDARY_HUY.matcher(scrubbed).find()
                || scrubbed.matches(".*\\bhuy\\s+(?:-\\s*|am\\s+)?\\d+(?:[.,]\\d+)?\\s*(?:bao|kg|ki|ky|lo|chai|goi|thung|don\\s+vi)\\b.*");
        boolean isTransfer = TRANSFER_EXPLICIT_PATTERN.matcher(scrubbed).find();
        return isDisposal || isTransfer;
    }

    private boolean isProductStockTransferMention(String norm) {
        if (norm == null || norm.isBlank()) {
            return false;
        }
        if (!norm.matches(".*\\b(?:chuyen|dieu\\s+chuyen)\\b.*")) {
            return false;
        }
        if (FLOCK_OR_NAV_EXCLUSION_PATTERN.matcher(norm).find()) {
            return false;
        }
        boolean hasStockUnit = norm.matches(".*\\b(?:bao|lo|chai|goi|thung|don\\s+vi)\\b.*");
        return hasStockUnit && mentionsSpecificProduct(norm, productCategoryRepository.findAll());
    }

    @Override
    public boolean canHandle(AssistantExecutionContext context) {
        if (Boolean.TRUE.equals(context.getConfirmAction())) {
            Map<String, Object> payload = context.getPendingActionPayload();
            return payload != null && "INTERNAL_STOCK_VOUCHER".equals(payload.get("actionType"));
        }

        String msg = context.getMessage();
        if (msg == null || msg.isBlank()) return false;
        String norm = VietnameseSpeechNormalizer.removeVietnameseDiacritics(msg).toLowerCase(Locale.ROOT);

        if (isLikelyPastedArticleOrNonCommand(norm, msg)) {
            return false;
        }

        // 1. Batch price inquiry signals (exclude low-stock threshold alerts which route to QUERY_FARM_STATUS unless avg price is asked)
        boolean isLowStockAlert = (norm.contains("sap het") || norm.contains("sap can")
                || norm.contains("ton thap") || norm.contains("ton kho thap") || norm.contains("duoi "))
                && !norm.contains("gia trung binh") && !norm.contains("don gia") && !norm.contains("gia binh quan");
        boolean isUpdateMutation = norm.matches(".*\\b(?:sua|doi|cap nhat|chinh|tang|giam)\\b.*");
        String msgViLower = msg.toLowerCase(Locale.forLanguageTag("vi-VN"));
        boolean isPoultryPhrase = msgViLower.contains("gia cầm")
                || (norm.contains("gia cam") && !msgViLower.contains("giá")
                && !norm.contains("don gia") && !norm.contains("gia trung binh")
                && !norm.contains("gia binh quan") && !norm.contains("gia nhap"));
        boolean isUnitOrAvgPriceLookup = !isUpdateMutation && (
                norm.contains("don gia")
                        || norm.contains("gia trung binh")
                        || norm.contains("gia binh quan")
                        || norm.contains("binh quan gia quyen")
                        || norm.contains("gia nhap")
                        || norm.contains("gia von")
                        || ((norm.contains("tra cuu") || norm.contains("kiem tra") || norm.contains("xem") || norm.contains("bao nhieu"))
                        && norm.matches(".*\\bgia\\b.*") && !isPoultryPhrase)
        );
        boolean isBatchQuery = !isLowStockAlert
                && (((norm.contains("ton kho") || norm.contains("trong kho") || norm.contains("kiem tra ton"))
                && (norm.contains("gia") || norm.contains("dot") || norm.contains("chi tiet") || norm.contains("lo") || norm.contains("bao nhieu")))
                || isUnitOrAvgPriceLookup);

        // 2. Internal movement signals (only EXPORT & TRANSFER with strict word boundaries)
        boolean isMovement = isInternalStockMovementIntent(norm) || isProductStockTransferMention(norm);

        return isBatchQuery || isMovement;
    }

    @Override
    @Transactional
    public AiAssistantResponse handle(AssistantExecutionContext context) {
        if (Boolean.TRUE.equals(context.getConfirmAction())) {
            return executeConfirmedVoucher(context);
        }

        String msg = context.getMessage();
        String norm = VietnameseSpeechNormalizer.removeVietnameseDiacritics(msg).toLowerCase(Locale.ROOT);

        if (isInternalStockMovementIntent(norm) || isProductStockTransferMention(norm)) {
            return handleInternalMovement(context);
        } else {
            return handleBatchPriceInquiry(context);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // 1. BATCH-LEVEL INVENTORY & PRICE INQUIRY (RBAC MASKED)
    // ─────────────────────────────────────────────────────────────
    private AiAssistantResponse handleBatchPriceInquiry(AssistantExecutionContext context) {
        String msg = context.getMessage();
        boolean canSeeFinance = !context.isWorker();

        List<InventoryItem> allItems = inventoryRepository.findAll();
        if (context.isWorker() && workAssignmentService != null && barnRepository != null) {
            List<WarehouseCategory> allWarehouses = warehouseRepository.findAllWithAreasForReport();
            Set<Long> areaBoundWarehouseIds = new HashSet<>();
            for (WarehouseCategory w : allWarehouses) {
                if (w.getArea() != null || (w.getAreas() != null && !w.getAreas().isEmpty())) {
                    areaBoundWarehouseIds.add(w.getId());
                }
            }

            Set<Long> allowedBarnIds = workAssignmentService.barnIdsOf(context.getUsername());
            Set<Long> allowedAreaIds = new HashSet<>();
            if (!allowedBarnIds.isEmpty()) {
                for (Barn b : barnRepository.findAll()) {
                    if (allowedBarnIds.contains(b.getId()) && b.getArea() != null && b.getArea().getId() != null) {
                        allowedAreaIds.add(b.getArea().getId());
                    }
                }
            }

            Set<Long> allowedWarehouseIds = new HashSet<>();
            if (!allowedAreaIds.isEmpty()) {
                for (WarehouseCategory w : allWarehouses) {
                    boolean matchesPrimary = w.getArea() != null && allowedAreaIds.contains(w.getArea().getId());
                    boolean matchesMulti = w.getAreas() != null && w.getAreas().stream()
                            .anyMatch(a -> a != null && allowedAreaIds.contains(a.getId()));
                    if (matchesPrimary || matchesMulti) {
                        allowedWarehouseIds.add(w.getId());
                    }
                }
                if (farmAreaRepository != null) {
                    for (Object[] pair : farmAreaRepository.findAreaWarehousePairs()) {
                        if (pair != null && pair.length >= 2 && pair[0] instanceof Long aId && pair[1] instanceof Long wId
                                && allowedAreaIds.contains(aId)) {
                            allowedWarehouseIds.add(wId);
                        }
                    }
                }
            }
            if (context.getUsername() != null && !context.getUsername().isBlank()) {
                for (WarehouseCategory w : allWarehouses) {
                    if (w.getWorkers() != null && w.getWorkers().stream()
                            .anyMatch(acc -> acc != null && acc.getEmail() != null
                                    && acc.getEmail().equalsIgnoreCase(context.getUsername()))) {
                        allowedWarehouseIds.add(w.getId());
                    }
                }
            }

            if (!allowedWarehouseIds.isEmpty()) {
                allItems = allItems.stream()
                        .filter(i -> i.getWarehouse() != null && allowedWarehouseIds.contains(i.getWarehouse().getId()))
                        .toList();
            } else {
                String msgNorm = VietnameseSpeechNormalizer.removeVietnameseDiacritics(msg).toLowerCase(Locale.ROOT);
                if (msgNorm.contains("khu toi") || msgNorm.contains("phu trach") || msgNorm.contains("khu minh")) {
                    allItems = List.of();
                } else {
                    // Fail-closed for area-bound warehouses when worker has no assigned barns or area warehouses
                    allItems = allItems.stream()
                            .filter(i -> i.getWarehouse() != null && !areaBoundWarehouseIds.contains(i.getWarehouse().getId()))
                            .toList();
                }
            }
        }

        String searchTarget = extractSearchTarget(msg, allItems);
        String targetNorm = VietnameseSpeechNormalizer.removeVietnameseDiacritics(searchTarget).toLowerCase(Locale.ROOT).trim();

        List<InventoryItem> matchedItems = allItems.stream()
                .filter(item -> {
                    if (item.getProduct() == null || item.getProduct().getName() == null) return false;
                    if (targetNorm.isBlank()) return true;
                    String pNorm = VietnameseSpeechNormalizer.removeVietnameseDiacritics(item.getProduct().getName()).toLowerCase(Locale.ROOT);
                    return pNorm.contains(targetNorm);
                })
                .sorted(Comparator.comparing(InventoryItem::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();

        if (matchedItems.isEmpty()) {
            return AiAssistantResponse.builder()
                    .reply("📦 Hiện không tìm thấy thông tin tồn kho cho mặt hàng **" + (searchTarget.isBlank() ? "yêu cầu" : searchTarget) + "** trong phạm vi kho được phép.")
                    .actionType("QUERY_STOCK_BATCH")
                    .executed(true)
                    .build();
        }

        BigDecimal totalStock = BigDecimal.ZERO;
        BigDecimal totalValue = BigDecimal.ZERO;
        BigDecimal simplePriceSum = BigDecimal.ZERO;
        int simplePriceCount = 0;
        int activeLotsCount = 0;
        Set<String> distinctProducts = new LinkedHashSet<>();
        Set<String> activeUnits = new LinkedHashSet<>();
        Set<String> allUnits = new LinkedHashSet<>();

        for (InventoryItem item : matchedItems) {
            distinctProducts.add(item.getProduct().getName());
            String rowUnit = item.getUnit() != null ? item.getUnit().getName() : null;
            if (rowUnit != null && !rowUnit.isBlank()) {
                allUnits.add(rowUnit);
            }
            BigDecimal stock = item.getStock() != null ? item.getStock() : BigDecimal.ZERO;
            BigDecimal price = item.getPrice() != null ? item.getPrice() : BigDecimal.ZERO;
            if (stock.compareTo(BigDecimal.ZERO) > 0) {
                activeLotsCount++;
                totalStock = totalStock.add(stock);
                totalValue = totalValue.add(stock.multiply(price));
                if (rowUnit != null && !rowUnit.isBlank()) {
                    activeUnits.add(rowUnit);
                }
            }
            if (price.compareTo(BigDecimal.ZERO) > 0) {
                simplePriceSum = simplePriceSum.add(price);
                simplePriceCount++;
            }
        }

        String headerTitle = distinctProducts.size() == 1
                ? distinctProducts.iterator().next()
                : (searchTarget.isBlank() ? "Tất cả vật tư kho" : searchTarget);
        String singleUnit = activeUnits.size() == 1
                ? activeUnits.iterator().next()
                : (activeUnits.isEmpty() && allUnits.size() == 1 ? allUnits.iterator().next() : (allUnits.isEmpty() ? "đơn vị" : null));

        BigDecimal weightedAvgPrice = BigDecimal.ZERO;
        boolean usedSimpleFallback = false;
        if (totalStock.compareTo(BigDecimal.ZERO) > 0) {
            weightedAvgPrice = totalValue.divide(totalStock, 0, RoundingMode.HALF_UP);
        } else if (simplePriceCount > 0) {
            weightedAvgPrice = simplePriceSum.divide(BigDecimal.valueOf(simplePriceCount), 0, RoundingMode.HALF_UP);
            usedSimpleFallback = true;
        }

        StringBuilder sb = new StringBuilder();
        if (canSeeFinance) {
            sb.append("📦 **Báo cáo tồn kho & chi tiết lô giá nhập: ").append(headerTitle).append("**\n\n");
            sb.append("| Mặt hàng | Kho | Mã lô (#date-time) | Tồn kho | Đơn giá nhập |\n");
            sb.append("| :--- | :--- | :--- | :--- | :--- |\n");

            for (InventoryItem item : matchedItems) {
                String batchCode = formatBatchCode(item);
                String whName = item.getWarehouse() != null ? item.getWarehouse().getName() : "Kho";
                String rowUnit = item.getUnit() != null ? item.getUnit().getName() : "đơn vị";
                String stockStr = formatQty(item.getStock()) + " " + rowUnit;
                String priceStr = formatCurrency(item.getPrice() != null ? item.getPrice() : BigDecimal.ZERO) + " VNĐ";
                sb.append("| ").append(item.getProduct().getName())
                        .append(" | ").append(whName)
                        .append(" | `").append(batchCode).append("`")
                        .append(" | ").append(stockStr)
                        .append(" | ").append(priceStr).append(" |\n");
            }

            if (distinctProducts.size() > 1) {
                sb.append("\n**Tổng hợp tồn kho & giá bình quân gia quyền theo từng mặt hàng:**\n");
                Map<String, List<InventoryItem>> byProduct = new LinkedHashMap<>();
                for (InventoryItem item : matchedItems) {
                    byProduct.computeIfAbsent(item.getProduct().getName(), k -> new ArrayList<>()).add(item);
                }
                for (Map.Entry<String, List<InventoryItem>> entry : byProduct.entrySet()) {
                    BigDecimal pStock = BigDecimal.ZERO;
                    BigDecimal pVal = BigDecimal.ZERO;
                    BigDecimal pSimpleSum = BigDecimal.ZERO;
                    int pSimpleCount = 0;
                    int pActiveLots = 0;
                    String pUnit = "đơn vị";
                    for (InventoryItem item : entry.getValue()) {
                        if (item.getUnit() != null && item.getUnit().getName() != null && !item.getUnit().getName().isBlank()) {
                            pUnit = item.getUnit().getName();
                        }
                        BigDecimal s = item.getStock() != null ? item.getStock() : BigDecimal.ZERO;
                        BigDecimal p = item.getPrice() != null ? item.getPrice() : BigDecimal.ZERO;
                        if (s.compareTo(BigDecimal.ZERO) > 0) {
                            pActiveLots++;
                            pStock = pStock.add(s);
                            pVal = pVal.add(s.multiply(p));
                        }
                        if (p.compareTo(BigDecimal.ZERO) > 0) {
                            pSimpleSum = pSimpleSum.add(p);
                            pSimpleCount++;
                        }
                    }
                    BigDecimal pAvg = BigDecimal.ZERO;
                    boolean pFallback = false;
                    if (pStock.compareTo(BigDecimal.ZERO) > 0) {
                        pAvg = pVal.divide(pStock, 0, RoundingMode.HALF_UP);
                    } else if (pSimpleCount > 0) {
                        pAvg = pSimpleSum.divide(BigDecimal.valueOf(pSimpleCount), 0, RoundingMode.HALF_UP);
                        pFallback = true;
                    }
                    sb.append("- **").append(entry.getKey()).append(":** tồn **")
                            .append(formatQty(pStock)).append(" ").append(pUnit).append("**");
                    if (pAvg.signum() > 0) {
                        sb.append(" · Giá TB").append(pFallback ? " (tham khảo, tồn = 0)" : " (BQGQ " + pActiveLots + " lô)")
                                .append(": **").append(formatCurrency(pAvg)).append(" VNĐ/").append(pUnit).append("**");
                    }
                    sb.append("\n");
                }
            } else if (singleUnit != null) {
                sb.append("\n- **Tổng tồn kho:** ").append(formatQty(totalStock)).append(" ").append(singleUnit);
                if (usedSimpleFallback) {
                    sb.append("\n- **Giá TB tham khảo (trung bình các lô do tổng tồn = 0):** ")
                            .append(formatCurrency(weightedAvgPrice)).append(" VNĐ/").append(singleUnit);
                } else {
                    sb.append("\n- **Giá TB (Bình quân gia quyền trên ").append(activeLotsCount).append(" lô còn tồn):** ")
                            .append(formatCurrency(weightedAvgPrice)).append(" VNĐ/").append(singleUnit);
                }
            } else {
                sb.append("\n- **Tổng số lô hiển thị:** ").append(matchedItems.size()).append(" lô");
                if (weightedAvgPrice.signum() > 0) {
                    sb.append("\n- **Giá TB (Bình quân gia quyền):** ").append(formatCurrency(weightedAvgPrice)).append(" VNĐ");
                }
            }
        } else {
            // ROLE_FARM_WORKER: Price columns COMPLETELY MASKED/STRIPPED
            sb.append("📦 **Báo cáo tồn kho theo lô: ").append(headerTitle).append("**\n\n");
            sb.append("| Mặt hàng | Kho | Mã lô (#date-time) | Tồn kho khả dụng |\n");
            sb.append("| :--- | :--- | :--- | :--- |\n");

            for (InventoryItem item : matchedItems) {
                String batchCode = formatBatchCode(item);
                String whName = item.getWarehouse() != null ? item.getWarehouse().getName() : "Kho";
                String rowUnit = item.getUnit() != null ? item.getUnit().getName() : "đơn vị";
                String stockStr = formatQty(item.getStock()) + " " + rowUnit;
                sb.append("| ").append(item.getProduct().getName())
                        .append(" | ").append(whName)
                        .append(" | `").append(batchCode).append("`")
                        .append(" | ").append(stockStr).append(" |\n");
            }

            if (singleUnit != null) {
                sb.append("\n- **Tổng tồn kho:** ").append(formatQty(totalStock)).append(" ").append(singleUnit);
            }
            sb.append("\n*(Thông tin đơn giá và tổng tiền được bảo mật theo phân quyền công nhân)*");
        }

        return AiAssistantResponse.builder()
                .reply(sb.toString())
                .actionType("QUERY_STOCK_BATCH")
                .executed(true)
                .navigateTo(canSeeFinance ? "/inventory" : "/today-tasks")
                .build();
    }

    // ─────────────────────────────────────────────────────────────
    // 2. INTERNAL STOCK MOVEMENTS (EXPORT & TRANSFER ONLY)
    // ─────────────────────────────────────────────────────────────
    private AiAssistantResponse handleInternalMovement(AssistantExecutionContext context) {
        String msg = context.getMessage();
        String norm = VietnameseSpeechNormalizer.removeVietnameseDiacritics(msg).toLowerCase(Locale.ROOT);
        String scrubbed = EXCLUDED_HUY_COMPOUNDS.matcher(norm).replaceAll(" ");

        String movementType;
        String categoryName;
        if (WORD_BOUNDARY_HUY.matcher(scrubbed).find()
                || scrubbed.matches(".*\\bhuy\\s+(?:-\\s*|am\\s+)?\\d+(?:[.,]\\d+)?\\s*(?:bao|kg|ki|ky|lo|chai|goi|thung|don\\s+vi)\\b.*")) {
            movementType = "EXPORT";
            categoryName = "Xuất hủy";
        } else {
            movementType = "TRANSFER";
            categoryName = "Chuyển kho nội bộ";
        }

        // RBAC Check via AiRbacPolicy
        if (context.isWorker()) {
            return AiRbacPolicy.createForbiddenResponse();
        }

        // 1. Validate negative or zero explicit quantities immediately (O15)
        Double parsedQtyBags = extractQuantityBagsOrNull(msg);
        if (parsedQtyBags != null && parsedQtyBags <= 0) {
            return AiAssistantResponse.builder()
                    .reply("⚠️ Số lượng phiếu kho nội bộ phải lớn hơn **0** (hệ thống nhận được **"
                            + formatCardQty(BigDecimal.valueOf(parsedQtyBags))
                            + "**). Vui lòng nhập số lượng dương hợp lệ.")
                    .actionType("VALIDATION_ERROR")
                    .executed(false)
                    .requiresConfirmation(false)
                    .build();
        }

        // 2. Parse explicit source/target warehouses and reject identical source & destination (A11)
        List<WarehouseCategory> allWarehouses = warehouseRepository.findAll();
        WarehouseSegmentPair whPair = extractWarehouseSegments(norm);
        WarehouseCategory explicitSourceWh = resolveWarehouseFromSegment(whPair.sourceSegment(), allWarehouses);
        WarehouseCategory explicitTargetWh = resolveWarehouseFromSegment(whPair.targetSegment(), allWarehouses);
        if (explicitTargetWh == null && isSameWarehouseReference(whPair.targetSegment())) {
            explicitTargetWh = explicitSourceWh;
        }

        if ("TRANSFER".equals(movementType)) {
            boolean sameByEntity = explicitSourceWh != null && explicitTargetWh != null
                    && Objects.equals(explicitSourceWh.getId(), explicitTargetWh.getId());
            boolean sameBySegment = !whPair.sourceSegment().isBlank() && !whPair.targetSegment().isBlank()
                    && (whPair.sourceSegment().equals(whPair.targetSegment()) || isSameWarehouseReference(whPair.targetSegment()));
            if (sameByEntity || sameBySegment) {
                String whName = explicitSourceWh != null ? explicitSourceWh.getName() : whPair.sourceRaw();
                return AiAssistantResponse.builder()
                        .reply("⚠️ Kho xuất và kho nhập không được trùng nhau (đều là **"
                                + (whName != null && !whName.isBlank() ? whName : "cùng một kho")
                                + "**). Vui lòng chọn 2 kho khác nhau để thực hiện chuyển kho.")
                        .actionType("VALIDATION_ERROR")
                        .executed(false)
                        .requiresConfirmation(false)
                        .build();
            }
        }

        // 3. Clarification if quantity or specific product is missing (A20)
        List<ProductCategory> allProducts = productCategoryRepository.findAll();
        boolean hasSpecificProduct = mentionsSpecificProduct(norm, allProducts);
        if (parsedQtyBags == null || !hasSpecificProduct) {
            return buildInternalMovementClarification(movementType, categoryName, parsedQtyBags);
        }

        double qtyBags = parsedQtyBags;
        String productName = extractFeedName(msg, "Cám Higro 01");
        ProductCategory product = resolveBestProductCategory(msg, productName, allProducts);
        String resolvedProductName = product != null ? product.getName() : productName;

        // 4. Real DB Stock Check (MSG27 / A10) before requiring target warehouse clarification
        List<InventoryItem> allInventory = inventoryRepository.findAll();
        boolean hasInventoryInDb = !allInventory.isEmpty();
        BigDecimal reqQty = BigDecimal.valueOf(qtyBags);

        final Long targetProdId = product != null ? product.getId() : null;
        List<InventoryItem> productItems = targetProdId != null
                ? allInventory.stream()
                        .filter(it -> it.getProduct() != null && Objects.equals(it.getProduct().getId(), targetProdId))
                        .toList()
                : allInventory.stream()
                        .filter(it -> it.getProduct() != null && it.getProduct().getName() != null
                                && VietnameseSpeechNormalizer.removeVietnameseDiacritics(it.getProduct().getName()).toLowerCase(Locale.ROOT)
                                        .contains(VietnameseSpeechNormalizer.removeVietnameseDiacritics(resolvedProductName).toLowerCase(Locale.ROOT)))
                        .toList();

        if (explicitSourceWh != null) {
            Set<Long> productStockWhIds = new HashSet<>();
            for (InventoryItem it : productItems) {
                if (it.getWarehouse() != null && it.getStock() != null && it.getStock().compareTo(BigDecimal.ZERO) > 0) {
                    productStockWhIds.add(it.getWarehouse().getId());
                }
            }
            if (!productStockWhIds.isEmpty() && !whPair.sourceSegment().isBlank()) {
                WarehouseCategory refinedSource = resolveWarehouseFromSegment(whPair.sourceSegment(), allWarehouses, productStockWhIds);
                if (refinedSource != null && (explicitTargetWh == null || !Objects.equals(refinedSource.getId(), explicitTargetWh.getId()))) {
                    explicitSourceWh = refinedSource;
                }
            }
            final Long srcWhId = explicitSourceWh.getId();
            List<InventoryItem> srcItems = productItems.stream()
                    .filter(it -> it.getWarehouse() != null && Objects.equals(it.getWarehouse().getId(), srcWhId))
                    .toList();
            BigDecimal srcAvailable = sumActiveStock(srcItems);
            if ((hasInventoryInDb || reqQty.compareTo(BigDecimal.valueOf(1000)) > 0) && reqQty.compareTo(srcAvailable) > 0) {
                return buildStockInsufficientResponse(srcAvailable, reqQty, explicitSourceWh.getName(), resolvedProductName);
            }
        } else {
            BigDecimal totalAvailable = sumActiveStock(productItems);
            BigDecimal maxWarehouseAvailable = maxWarehouseStock(productItems);
            BigDecimal effectiveLimit = "TRANSFER".equals(movementType) && !productItems.isEmpty()
                    ? maxWarehouseAvailable
                    : totalAvailable;
            if ((hasInventoryInDb || reqQty.compareTo(BigDecimal.valueOf(1000)) > 0) && reqQty.compareTo(effectiveLimit) > 0) {
                String scopeLabel = productItems.isEmpty() ? "toàn trại" : "mỗi kho";
                return buildStockInsufficientResponse(effectiveLimit, reqQty, scopeLabel, resolvedProductName);
            }
        }

        // 5. Require explicit source & destination warehouses for TRANSFER if missing/generic (after MSG27 stock check)
        if ("TRANSFER".equals(movementType) && (explicitSourceWh == null || explicitTargetWh == null)) {
            return buildTransferWarehouseClarification(qtyBags, resolvedProductName, explicitSourceWh, explicitTargetWh, allWarehouses, productItems);
        }

        WarehouseCategory sourceWh = explicitSourceWh != null
                ? explicitSourceWh
                : findWarehouseWithStock(productItems, msg, "Kho cám", true);
        WarehouseCategory targetWh = explicitTargetWh;

        InventoryItem sourceItem = findBestSourceInventoryItem(sourceWh, product, reqQty);
        if (sourceItem != null) {
            if (sourceWh == null) {
                sourceWh = sourceItem.getWarehouse();
            }
            if (product == null) {
                product = sourceItem.getProduct();
            }
        }

        // Pre-Flight Lot Stock Check (MSG27)
        final Long resolvedSourceWhId = sourceWh != null ? sourceWh.getId() : null;
        if (sourceItem != null && sourceItem.getStock() != null && ("EXPORT".equals(movementType) || "TRANSFER".equals(movementType))) {
            BigDecimal lotOrWhStock = resolvedSourceWhId != null
                    ? sumActiveStock(productItems.stream()
                            .filter(it -> it.getWarehouse() != null && Objects.equals(it.getWarehouse().getId(), resolvedSourceWhId))
                            .toList())
                    : sourceItem.getStock();
            BigDecimal checkStock = lotOrWhStock.compareTo(BigDecimal.ZERO) > 0 ? lotOrWhStock : sourceItem.getStock();
            if (reqQty.compareTo(checkStock) > 0) {
                return buildStockInsufficientResponse(checkStock, reqQty,
                        sourceWh != null ? sourceWh.getName() : "kho hiện tại", resolvedProductName);
            }
        }

        // Prepare Confirmation Card
        String batchCode = sourceItem != null ? formatBatchCode(sourceItem) : "#" + LocalDateTime.now(CycleService.VN_ZONE).format(BATCH_CODE_FORMATTER);
        BigDecimal stockBefore = sourceItem != null && sourceItem.getStock() != null ? sourceItem.getStock() : BigDecimal.valueOf(50);
        BigDecimal stockAfter = stockBefore.subtract(reqQty).max(BigDecimal.ZERO);
        String qtyDisplay = formatCardQty(reqQty);
        String stockAfterDisplay = formatCardQty(stockAfter);
        String unitLabel = (sourceItem != null && sourceItem.getUnit() != null && sourceItem.getUnit().getName() != null && !sourceItem.getUnit().getName().isBlank())
                ? (sourceItem.getUnit().getName().toLowerCase(Locale.ROOT).contains("bao") ? "bao" : sourceItem.getUnit().getName())
                : "bao";

        Map<String, Object> details = new LinkedHashMap<>();
        details.put("Loại phiếu", categoryName);
        if ("TRANSFER".equals(movementType)) {
            details.put("Kho xuất → Kho nhập", (sourceWh != null ? sourceWh.getName() : "Kho xuất") + " → " + (targetWh != null ? targetWh.getName() : "Kho nhập"));
        } else {
            details.put("Kho xuất", sourceWh != null ? sourceWh.getName() : "Kho cám");
        }
        details.put("Mặt hàng & Lô áp dụng", (product != null ? product.getName() : productName) + " " + batchCode + " (" + qtyDisplay + " " + unitLabel + ")");
        details.put("Tồn kho sau thao tác", stockAfterDisplay + " " + unitLabel + " (Giảm " + qtyDisplay + " " + unitLabel + ")");

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("actionType", "INTERNAL_STOCK_VOUCHER");
        payload.put("movementType", movementType);
        payload.put("categoryName", categoryName);
        payload.put("productId", product != null ? product.getId() : null);
        payload.put("sourceWarehouseId", sourceWh != null ? sourceWh.getId() : null);
        payload.put("targetWarehouseId", targetWh != null ? targetWh.getId() : null);
        payload.put("inventoryItemId", sourceItem != null ? sourceItem.getId() : null);
        payload.put("quantity", qtyBags);
        payload.put("productName", product != null ? product.getName() : productName);

        return AiAssistantResponse.builder()
                .reply("Bạn có muốn tạo phiếu **" + categoryName + "** cho **" + qtyDisplay + " bao " + (product != null ? product.getName() : productName) + "** không?")
                .actionType("INTERNAL_STOCK_VOUCHER")
                .executed(false)
                .requiresConfirmation(true)
                .pendingAction(Map.of(
                        "actionType", "INTERNAL_STOCK_VOUCHER",
                        "title", "Xác nhận phiếu " + categoryName,
                        "description", "Thực hiện " + categoryName.toLowerCase() + " trong hệ thống kho nội bộ",
                        "details", details,
                        "payload", payload
                ))
                .build();
    }

    private AiAssistantResponse executeConfirmedVoucher(AssistantExecutionContext context) {
        Map<String, Object> payload = context.getPendingActionPayload();
        if (payload == null) return null;

        String movementType = (String) payload.get("movementType");
        String categoryName = (String) payload.get("categoryName");
        Long sourceWhId = payload.get("sourceWarehouseId") != null ? ((Number) payload.get("sourceWarehouseId")).longValue() : null;
        Long targetWhId = payload.get("targetWarehouseId") != null ? ((Number) payload.get("targetWarehouseId")).longValue() : null;
        Long productId = payload.get("productId") != null ? ((Number) payload.get("productId")).longValue() : null;
        Long invItemId = payload.get("inventoryItemId") != null ? ((Number) payload.get("inventoryItemId")).longValue() : null;
        double quantity = payload.get("quantity") != null ? ((Number) payload.get("quantity")).doubleValue() : 0.0;
        String productName = (String) payload.get("productName");

        if (quantity <= 0) {
            return AiAssistantResponse.builder()
                    .reply("⚠️ Số lượng phiếu kho phải lớn hơn **0**. Giao dịch đã bị hủy để đảm bảo toàn vẹn dữ liệu.")
                    .actionType("VALIDATION_ERROR")
                    .executed(false)
                    .requiresConfirmation(false)
                    .build();
        }
        if ("TRANSFER".equals(movementType) && sourceWhId != null && sourceWhId.equals(targetWhId)) {
            return AiAssistantResponse.builder()
                    .reply("⚠️ Kho xuất và kho nhập không được trùng nhau. Vui lòng chọn 2 kho khác nhau.")
                    .actionType("VALIDATION_ERROR")
                    .executed(false)
                    .requiresConfirmation(false)
                    .build();
        }

        // Find internal stock category
        InternalStockCategory cat = internalStockCategoryRepository.findAll().stream()
                .filter(c -> c.getMovementType().equalsIgnoreCase(movementType))
                .findFirst()
                .orElse(null);

        if (cat == null) {
            cat = new InternalStockCategory();
            cat.setMovementType(movementType);
            cat.setName(categoryName);
            cat.setNameKey(VietnameseSpeechNormalizer.removeVietnameseDiacritics(categoryName).toLowerCase());
            cat = internalStockCategoryRepository.save(cat);
        }

        BigDecimal unitPrice = BigDecimal.valueOf(310000.0);
        if (invItemId != null) {
            unitPrice = inventoryRepository.findById(invItemId)
                    .map(InventoryItem::getPrice)
                    .filter(Objects::nonNull)
                    .orElse(unitPrice);
        }

        InternalStockVoucherItemRequest itemReq = new InternalStockVoucherItemRequest(
                productId,
                invItemId,
                null,
                BigDecimal.valueOf(quantity),
                unitPrice,
                "Thực hiện qua Trợ lý AI"
        );

        InternalStockVoucherRequest req = new InternalStockVoucherRequest(
                movementType,
                cat.getId(),
                sourceWhId,
                targetWhId,
                null,
                LocalDate.now(CycleService.VN_ZONE),
                "Tạo tự động qua Trợ lý Giọng nói FarmShift AI",
                null,
                List.of(itemReq)
        );

        try {
            var voucher = internalStockService.create(req, context.getUsername() != null ? context.getUsername() : "Trợ lý AI");
            Map<String, Object> summary = new LinkedHashMap<>();
            summary.put("title", "Đã lập phiếu " + categoryName + ": " + voucher.code());
            summary.put("voucherCode", voucher.code());
            summary.put("detail", categoryName + " " + formatCardQty(BigDecimal.valueOf(quantity)) + " bao " + productName);
            summary.put("timestamp", LocalDateTime.now(CycleService.VN_ZONE).toString());

            return AiAssistantResponse.builder()
                    .reply("✅ Đã tạo thành công phiếu **" + categoryName + "** (Mã: `" + voucher.code() + "`). Số lượng tồn kho các kho đã được cập nhật đồng bộ.")
                    .actionType("INTERNAL_STOCK_VOUCHER")
                    .executed(true)
                    .uiCommand("REFRESH_DATA")
                    .navigateTo("/transfers")
                    .actionSummary(summary)
                    .build();
        } catch (Exception ex) {
            log.warn("Lỗi tạo phiếu nội bộ: {}", ex.getMessage());
            return AiAssistantResponse.builder()
                    .reply("⚠️ Không thể tạo phiếu xuất nhập nội bộ: " + ex.getMessage())
                    .actionType("INTERNAL_STOCK_VOUCHER")
                    .executed(false)
                    .build();
        }
    }

    // ─────────────────────────────────────────────────────────────
    // UTILITY HELPERS
    // ─────────────────────────────────────────────────────────────
    private String formatBatchCode(InventoryItem item) {
        if (item.getCreatedAt() != null) {
            return "#" + item.getCreatedAt().format(BATCH_CODE_FORMATTER);
        }
        return "#20261029-1330";
    }

    private String formatQty(BigDecimal qty) {
        return formatCardQty(qty);
    }

    private String formatCardQty(BigDecimal qty) {
        if (qty == null) return "0";
        BigDecimal scaled = qty.setScale(2, RoundingMode.HALF_UP);
        if (scaled.compareTo(BigDecimal.ZERO) == 0) return "0";
        return scaled.stripTrailingZeros().toPlainString();
    }

    private String extractSearchTarget(String text, List<InventoryItem> allItems) {
        String norm = VietnameseSpeechNormalizer.removeVietnameseDiacritics(text).toLowerCase(Locale.ROOT);
        if (allItems != null) {
            String bestName = null;
            for (InventoryItem it : allItems) {
                if (it.getProduct() == null || it.getProduct().getName() == null) continue;
                String pName = it.getProduct().getName();
                String pNorm = VietnameseSpeechNormalizer.removeVietnameseDiacritics(pName).toLowerCase(Locale.ROOT);
                if (norm.contains(pNorm) && (bestName == null || pName.length() > bestName.length())) {
                    bestName = pName;
                }
            }
            if (bestName != null) return bestName;
        }
        if (norm.contains("cargill 1502") || norm.contains("1502") || norm.contains("cargill")) return "Cargill 1502";
        if (norm.contains("higro 510") || norm.contains("510")) return "Higro 510";
        if (norm.contains("higro 01")) return "Higro 01";
        if (norm.contains("higro 02")) return "Higro 02";
        if (norm.contains("cp 511") || norm.contains("511")) return "CP 511";
        if (norm.contains("h5n1")) return "H5N1";
        if (norm.contains("lasota")) return "Lasota";
        if (norm.contains("gumboro")) return "Gumboro";
        if (norm.contains("marek")) return "Marek";
        if (norm.contains("bio-zyme") || norm.contains("biozyme") || norm.contains("men tieu hoa")) return "Bio-Zyme";
        if (norm.contains("han-coc") || norm.contains("toltrazuril")) return "Han-Coc";
        if (norm.contains("bkc")) return "BKC";
        if (norm.contains("vitamin") || norm.contains("dien giai")) return "Vitamin";
        if (allItems != null) {
            Set<String> ignoredTokens = Set.of(
                    "cam", "thuoc", "vac", "xin", "gia", "don", "trung", "binh", "quan", "nhap", "von",
                    "ton", "kho", "trong", "kiem", "tra", "cuu", "xem", "chi", "tiet", "tung", "dot",
                    "lo", "cua", "cho", "ga", "giai", "doan", "loai", "bao", "nhieu", "hien", "tai", "cac"
            );
            String bestTokenProduct = null;
            int bestScore = 0;
            for (InventoryItem it : allItems) {
                if (it.getProduct() == null || it.getProduct().getName() == null) continue;
                String pName = it.getProduct().getName();
                String pNorm = VietnameseSpeechNormalizer.removeVietnameseDiacritics(pName).toLowerCase(Locale.ROOT);
                int score = 0;
                for (String token : pNorm.split("\\s+")) {
                    if (token.length() >= 3 && !ignoredTokens.contains(token) && norm.matches(".*\\b" + Pattern.quote(token) + "\\b.*")) {
                        score += token.length();
                    }
                }
                if (score > bestScore) {
                    bestScore = score;
                    bestTokenProduct = pName;
                }
            }
            if (bestTokenProduct != null) {
                return bestTokenProduct;
            }
        }
        if (norm.contains("cam")) return "Cám";
        if (norm.contains("vac xin") || norm.contains("vac-xin")) return "Vắc-xin";
        if (norm.contains("thuoc")) return "Thuốc";
        return "";
    }

    private String extractFeedName(String text, String fallback) {
        String norm = VietnameseSpeechNormalizer.removeVietnameseDiacritics(text).toLowerCase(Locale.ROOT);
        if (norm.contains("cargill 1502") || norm.contains("1502") || norm.contains("cargill")) return "Cám Gà vỗ béo Cargill 1502";
        if (norm.contains("higro 510") || norm.contains("510")) return "Cám Gà choai Higro 510";
        if (norm.contains("higro 01") || norm.contains("cam so 1")) return "Cám Higro 01";
        if (norm.contains("higro 02") || norm.contains("cam so 2")) return "Cám Higro 02";
        if (norm.contains("cp 511") || norm.contains("511")) return "Cám Gà con CP 511";
        List<ProductCategory> allProducts = productCategoryRepository.findAll();
        for (ProductCategory p : allProducts) {
            if (p.getName() == null || p.getName().isBlank()) continue;
            String pNorm = VietnameseSpeechNormalizer.removeVietnameseDiacritics(p.getName()).toLowerCase(Locale.ROOT);
            if (!pNorm.isBlank() && norm.contains(pNorm)) {
                return p.getName();
            }
        }
        return fallback;
    }

    private Double extractQuantityBagsOrNull(String text) {
        if (text == null || text.isBlank()) return null;
        String norm = VietnameseSpeechNormalizer.removeVietnameseDiacritics(text).toLowerCase(Locale.ROOT);
        // Match signed "[-|am] X bao / lo / chai / goi / thung"
        Matcher unitMatcher = Pattern.compile("(?<![\\p{L}\\d.])(-\\s*|\\bam\\s+)?(\\d+(?:[.,]\\d+)?)\\s*(?:bao|lo|chai|goi|thung|don\\s+vi)\\b").matcher(norm);
        if (unitMatcher.find()) {
            return parseSignedNumber(unitMatcher.group(1), unitMatcher.group(2), 1.0);
        }
        // Match signed "[-|am] Y kg / ki / ky / can" (1 bao = 25kg)
        Matcher kgMatcher = Pattern.compile("(?<![\\p{L}\\d.])(-\\s*|\\bam\\s+)?(\\d+(?:[.,]\\d+)?)\\s*(?:kg|ki|ky|can|kilogram)\\b").matcher(norm);
        if (kgMatcher.find()) {
            Double kg = parseSignedNumber(kgMatcher.group(1), kgMatcher.group(2), 1.0);
            return kg != null ? kg / 25.0 : null;
        }
        // Only allow unitless number when it immediately follows the movement verb
        Matcher verbNumMatcher = Pattern.compile("(?:xuat\\s+huy|tieu\\s+huy|chuyen\\s+kho|dieu\\s+chuyen|chuyen)\\s+(?<![\\p{L}\\d.])(-\\s*|\\bam\\s+)?(\\d+(?:[.,]\\d+)?)\\b").matcher(norm);
        if (verbNumMatcher.find()) {
            return parseSignedNumber(verbNumMatcher.group(1), verbNumMatcher.group(2), 1.0);
        }
        return null;
    }

    private Double parseSignedNumber(String signToken, String numToken, double factor) {
        if (numToken == null || numToken.isBlank()) return null;
        try {
            double val = Double.parseDouble(numToken.replace(",", ".")) * factor;
            if (signToken != null && !signToken.isBlank()) {
                return -Math.abs(val);
            }
            return val;
        } catch (Exception ignored) {
            return null;
        }
    }

    private record WarehouseSegmentPair(String sourceSegment, String targetSegment, String sourceRaw) {}

    private WarehouseSegmentPair extractWarehouseSegments(String norm) {
        if (norm == null || norm.isBlank()) return new WarehouseSegmentPair("", "", "");
        String cleanedNorm = norm
                .replaceAll("\\b(?:giup\\s+toi|giup\\s+minh|ho\\s+toi|ho\\s+minh|cho\\s+toi|cho\\s+minh|giup\\s+voi|duoc\\s+khong)\\b", " ")
                .replaceAll("\\s+", " ")
                .trim();
        String srcSeg = "";
        String dstSeg = "";
        String srcRaw = "";

        Matcher fromToMatcher = Pattern.compile(
                "(?:tu|xuat\\s+(?:tu\\s+)?kho)\\s+(.+?)\\s+(?:sang|den|qua|ve|toi\\s+(?:chinh\\s+)?kho)\\s+(.+?)(?:\\s+(?:giup|ho|nhe|nha|ngay|voi)|[.?!]|$)"
        ).matcher(cleanedNorm);
        if (fromToMatcher.find()) {
            srcRaw = fromToMatcher.group(1).trim();
            srcSeg = cleanWarehouseSegment(srcRaw);
            dstSeg = cleanWarehouseSegment(fromToMatcher.group(2).trim());
            return new WarehouseSegmentPair(srcSeg, dstSeg, srcRaw);
        }

        Matcher fromOnly = Pattern.compile("(?:tu|xuat\\s+(?:tu\\s+)?kho)\\s+(.+?)(?:\\s+(?:giup|ho|nhe|nha|voi)|[.?!]|$)").matcher(cleanedNorm);
        if (fromOnly.find()) {
            srcRaw = fromOnly.group(1).trim();
            srcSeg = cleanWarehouseSegment(srcRaw);
        }
        Matcher toOnly = Pattern.compile("(?:sang|den|qua|ve|nhap\\s+kho)\\s+(.+?)(?:\\s+(?:giup|ho|nhe|nha|voi)|[.?!]|$)").matcher(cleanedNorm);
        if (toOnly.find()) {
            dstSeg = cleanWarehouseSegment(toOnly.group(1).trim());
        }
        return new WarehouseSegmentPair(srcSeg, dstSeg, srcRaw);
    }

    private String cleanWarehouseSegment(String seg) {
        if (seg == null) return "";
        String cleaned = seg.trim()
                .replaceAll("^(?:lai\\s+|dung\\s+|chinh\\s+)*(?:tai\\s+|ben\\s+)?", "")
                .replaceAll("\\s+(?:giup\\s+toi|giup\\s+minh|giup|ho\\s+toi|ho|duoc\\s+khong|nhe|nha|voi)$", "")
                .replaceAll("\\s+", " ")
                .trim();
        return cleaned;
    }

    private boolean isSameWarehouseReference(String targetSegment) {
        if (targetSegment == null || targetSegment.isBlank()) return false;
        String t = targetSegment.trim();
        return t.equals("no") || t.equals("chinh no")
                || t.equals("kho do") || t.equals("chinh kho do")
                || t.equals("kho nay") || t.equals("chinh kho nay")
                || t.equals("kho cu") || t.equals("cho cu");
    }

    private WarehouseCategory resolveWarehouseFromSegment(String segment, List<WarehouseCategory> allWarehouses) {
        return resolveWarehouseFromSegment(segment, allWarehouses, Set.of());
    }

    private WarehouseCategory resolveWarehouseFromSegment(String segment, List<WarehouseCategory> allWarehouses, Set<Long> preferredWarehouseIds) {
        if (segment == null || segment.isBlank() || allWarehouses == null || allWarehouses.isEmpty()) {
            return null;
        }
        String normSeg = VietnameseSpeechNormalizer.removeVietnameseDiacritics(segment).toLowerCase(Locale.ROOT).trim();
        if (normSeg.isBlank()) return null;

        List<WarehouseCategory> partialMatches = new ArrayList<>();
        for (WarehouseCategory wh : allWarehouses) {
            if (wh.getName() == null || wh.getName().isBlank()) continue;
            String whNorm = VietnameseSpeechNormalizer.removeVietnameseDiacritics(wh.getName()).toLowerCase(Locale.ROOT).trim();
            if (normSeg.equals(whNorm)) {
                return wh;
            }
            if (normSeg.contains(whNorm) || whNorm.contains(normSeg)) {
                partialMatches.add(wh);
            }
        }
        if (partialMatches.isEmpty()) {
            return null;
        }
        if (preferredWarehouseIds != null && !preferredWarehouseIds.isEmpty()) {
            List<WarehouseCategory> preferredMatches = partialMatches.stream()
                    .filter(w -> preferredWarehouseIds.contains(w.getId()))
                    .toList();
            if (!preferredMatches.isEmpty()) {
                partialMatches = preferredMatches;
            }
        }
        WarehouseCategory bestMatch = partialMatches.get(0);
        int bestDiff = Integer.MAX_VALUE;
        for (WarehouseCategory wh : partialMatches) {
            String whNorm = VietnameseSpeechNormalizer.removeVietnameseDiacritics(wh.getName()).toLowerCase(Locale.ROOT).trim();
            int diff = Math.abs(whNorm.length() - normSeg.length());
            if (diff < bestDiff) {
                bestMatch = wh;
                bestDiff = diff;
            }
        }
        return bestMatch;
    }

    private BigDecimal sumActiveStock(List<InventoryItem> items) {
        if (items == null || items.isEmpty()) return BigDecimal.ZERO;
        BigDecimal total = BigDecimal.ZERO;
        for (InventoryItem it : items) {
            if (it.getStock() != null && it.getStock().compareTo(BigDecimal.ZERO) > 0) {
                total = total.add(it.getStock());
            }
        }
        return total;
    }

    private BigDecimal maxWarehouseStock(List<InventoryItem> items) {
        if (items == null || items.isEmpty()) return BigDecimal.ZERO;
        Map<Long, BigDecimal> perWh = new LinkedHashMap<>();
        for (InventoryItem it : items) {
            if (it.getStock() == null || it.getStock().compareTo(BigDecimal.ZERO) <= 0) continue;
            Long whId = it.getWarehouse() != null ? it.getWarehouse().getId() : -1L;
            perWh.merge(whId, it.getStock(), BigDecimal::add);
        }
        BigDecimal max = BigDecimal.ZERO;
        for (BigDecimal val : perWh.values()) {
            if (val.compareTo(max) > 0) max = val;
        }
        return max;
    }

    private AiAssistantResponse buildStockInsufficientResponse(BigDecimal currentStock, BigDecimal reqQty, String scopeLabel, String productName) {
        return AiAssistantResponse.builder()
                .reply("⚠️ Tồn kho khả dụng của **" + productName + "** tại " + scopeLabel
                        + " không đủ. Giao dịch này sẽ làm cho số dư tồn kho bị âm (Hiện có: **"
                        + formatCardQty(currentStock) + " Bao**, Yêu cầu: **" + formatCardQty(reqQty)
                        + " Bao**). Vui lòng kiểm tra lại.")
                .actionType("STOCK_INSUFFICIENT")
                .executed(false)
                .requiresConfirmation(false)
                .build();
    }

    private AiAssistantResponse buildTransferWarehouseClarification(double qtyBags, String productName,
                                                                    WarehouseCategory explicitSource, WarehouseCategory explicitTarget,
                                                                    List<WarehouseCategory> allWarehouses, List<InventoryItem> productItems) {
        String qtyText = formatCardQty(BigDecimal.valueOf(qtyBags));
        List<Map<String, Object>> options = new ArrayList<>();
        Set<Long> addedPairs = new LinkedHashSet<>();

        List<InventoryItem> activeProductItems = productItems.stream()
                .filter(i -> i.getStock() != null && i.getStock().compareTo(BigDecimal.ZERO) > 0 && i.getWarehouse() != null)
                .toList();

        for (InventoryItem item : activeProductItems) {
            WarehouseCategory srcWh = explicitSource != null ? explicitSource : item.getWarehouse();
            if (!addedPairs.add(srcWh.getId())) continue;
            WarehouseCategory dstWh = explicitTarget;
            if (dstWh == null || Objects.equals(dstWh.getId(), srcWh.getId())) {
                dstWh = allWarehouses.stream()
                        .filter(w -> w.getName() != null && !Objects.equals(w.getId(), srcWh.getId()))
                        .findFirst()
                        .orElse(null);
            }
            if (dstWh == null) continue;
            Map<String, Object> opt = new LinkedHashMap<>();
            opt.put("badge", "Chọn kho chuyển");
            opt.put("label", "🔄 Chuyển " + qtyText + " bao " + productName + " (" + srcWh.getName() + " → " + dstWh.getName() + ")");
            opt.put("description", "Tồn hiện tại tại " + srcWh.getName() + ": " + formatQty(item.getStock()) + " bao");
            opt.put("prompt", "Chuyển " + qtyText + " bao " + productName + " từ " + srcWh.getName() + " sang " + dstWh.getName());
            opt.put("autoSend", true);
            options.add(opt);
            if (options.size() >= 3) break;
        }

        if (options.isEmpty() && allWarehouses.size() >= 2) {
            WarehouseCategory s = explicitSource != null ? explicitSource : allWarehouses.get(0);
            WarehouseCategory d = explicitTarget != null ? explicitTarget : allWarehouses.stream()
                    .filter(w -> !Objects.equals(w.getId(), s.getId())).findFirst().orElse(allWarehouses.get(1));
            Map<String, Object> opt = new LinkedHashMap<>();
            opt.put("badge", "Chọn kho chuyển");
            opt.put("label", "🔄 Chuyển " + qtyText + " bao " + productName + " (" + s.getName() + " → " + d.getName() + ")");
            opt.put("description", "Xác định rõ cặp kho xuất và kho nhập");
            opt.put("prompt", "Chuyển " + qtyText + " bao " + productName + " từ " + s.getName() + " sang " + d.getName());
            opt.put("autoSend", false);
            options.add(opt);
        }

        return AiAssistantResponse.builder()
                .reply("🤔 Bạn muốn chuyển **" + qtyText + " bao " + productName + "** nhưng chưa chỉ rõ **kho xuất** và **kho nhập** cụ thể.\n"
                        + "Vui lòng chọn cặp kho phù hợp bên dưới hoặc gõ rõ `từ <Kho A> sang <Kho B>`:")
                .actionType("CLARIFICATION_REQUIRED")
                .executed(false)
                .requiresConfirmation(false)
                .clarificationOptions(options)
                .build();
    }

    private boolean mentionsSpecificProduct(String norm, List<ProductCategory> allProducts) {
        if (norm == null || norm.isBlank()) return false;
        for (String kw : KNOWN_PRODUCT_KEYWORDS) {
            if (norm.contains(kw)) {
                return true;
            }
        }
        if (allProducts != null) {
            for (ProductCategory p : allProducts) {
                if (p.getName() == null || p.getName().isBlank()) continue;
                String pNorm = VietnameseSpeechNormalizer.removeVietnameseDiacritics(p.getName()).toLowerCase(Locale.ROOT).trim();
                if (norm.contains(pNorm)) {
                    return true;
                }
                for (String token : pNorm.split("\\s+")) {
                    if (token.length() >= 3 && !Set.of("cam", "thuoc", "giong", "giai", "doan", "loai", "cho").contains(token)
                            && norm.contains(token)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    private AiAssistantResponse buildInternalMovementClarification(String movementType, String categoryName, Double parsedQtyBags) {
        String qtyPlaceholder = (parsedQtyBags != null && parsedQtyBags > 0)
                ? formatCardQty(BigDecimal.valueOf(parsedQtyBags))
                : "...";
        boolean hasQty = parsedQtyBags != null && parsedQtyBags > 0;
        List<InventoryItem> activeStock = inventoryRepository.findAll().stream()
                .filter(i -> i.getStock() != null && i.getStock().signum() > 0 && i.getProduct() != null)
                .toList();
        List<WarehouseCategory> warehouses = warehouseRepository.findAll();

        List<Map<String, Object>> options = new ArrayList<>();
        if ("EXPORT".equals(movementType)) {
            Set<String> seenProducts = new LinkedHashSet<>();
            for (InventoryItem item : activeStock) {
                String pName = item.getProduct().getName();
                if (!seenProducts.add(pName)) continue;
                String unitName = item.getUnit() != null ? item.getUnit().getName() : "bao";
                String whName = item.getWarehouse() != null ? item.getWarehouse().getName() : "Kho hiện tại";
                Map<String, Object> opt = new LinkedHashMap<>();
                opt.put("badge", "Xuất hủy");
                opt.put("label", "📦 Xuất hủy " + qtyPlaceholder + " bao/đơn vị " + pName);
                opt.put("description", "Đang tồn " + formatQty(item.getStock()) + " " + unitName + " tại " + whName);
                opt.put("prompt", "Xuất hủy " + qtyPlaceholder + " bao " + pName + (item.getWarehouse() != null ? " từ " + whName : ""));
                opt.put("autoSend", hasQty);
                options.add(opt);
                if (options.size() >= 3) break;
            }
            if (options.isEmpty()) {
                Map<String, Object> fallbackOpt = new LinkedHashMap<>();
                fallbackOpt.put("badge", "Xuất hủy");
                fallbackOpt.put("label", "📦 Tạo phiếu Xuất hủy (điền số lượng & tên vật tư)");
                fallbackOpt.put("description", "Điền số bao và mặt hàng cần xuất hủy để AI lập thẻ xác nhận");
                fallbackOpt.put("prompt", "Xuất hủy " + qtyPlaceholder + " bao cám Higro 01");
                fallbackOpt.put("autoSend", false);
                options.add(fallbackOpt);
            }
        } else {
            String sourceName = warehouses.size() >= 1 ? warehouses.get(0).getName() : "Kho Cám";
            String targetName = warehouses.size() >= 2 ? warehouses.get(1).getName() : "Kho Khu B";
            Set<String> seenProducts = new LinkedHashSet<>();
            for (InventoryItem item : activeStock) {
                String pName = item.getProduct().getName();
                if (!seenProducts.add(pName)) continue;
                String srcWh = item.getWarehouse() != null ? item.getWarehouse().getName() : sourceName;
                String dstWh = warehouses.stream()
                        .filter(w -> w.getName() != null && !w.getName().equalsIgnoreCase(srcWh))
                        .map(WarehouseCategory::getName)
                        .findFirst()
                        .orElse(targetName);
                String unitName = item.getUnit() != null ? item.getUnit().getName() : "bao";
                Map<String, Object> opt = new LinkedHashMap<>();
                opt.put("badge", "Chuyển kho");
                opt.put("label", "🔄 Chuyển " + qtyPlaceholder + " bao " + pName + " (" + srcWh + " → " + dstWh + ")");
                opt.put("description", "Đang tồn " + formatQty(item.getStock()) + " " + unitName + " tại " + srcWh);
                opt.put("prompt", "Chuyển " + qtyPlaceholder + " bao " + pName + " từ " + srcWh + " sang " + dstWh);
                opt.put("autoSend", hasQty && !srcWh.equalsIgnoreCase(dstWh));
                options.add(opt);
                if (options.size() >= 3) break;
            }
            if (options.isEmpty()) {
                Map<String, Object> fallbackOpt = new LinkedHashMap<>();
                fallbackOpt.put("badge", "Chuyển kho");
                fallbackOpt.put("label", "🔄 Tạo phiếu Chuyển kho (điền số lượng & tên vật tư)");
                fallbackOpt.put("description", "Từ " + sourceName + " sang " + targetName);
                fallbackOpt.put("prompt", "Chuyển " + qtyPlaceholder + " bao cám Higro 02 từ " + sourceName + " sang " + targetName);
                fallbackOpt.put("autoSend", false);
                options.add(fallbackOpt);
            }
        }

        Map<String, Object> inspectOpt = new LinkedHashMap<>();
        inspectOpt.put("badge", "Xem tồn kho");
        inspectOpt.put("label", "📊 Xem chi tiết tồn kho & từng lô hàng trước");
        inspectOpt.put("description", "Kiểm tra số lượng tồn trước khi lập phiếu");
        inspectOpt.put("prompt", "Kiểm tra tồn kho và chi tiết từng lô");
        inspectOpt.put("autoSend", true);
        options.add(inspectOpt);

        return AiAssistantResponse.builder()
                .reply("🤔 Bạn muốn lập phiếu **" + categoryName + "** nhưng câu lệnh chưa nêu rõ **mặt hàng"
                        + (hasQty ? " hoặc kho" : " hoặc số lượng")
                        + " cụ thể**.\n"
                        + "Để tránh tạo nhầm phiếu kho, vui lòng chọn đúng phương án bên dưới hoặc bổ sung thông tin:")
                .actionType("CLARIFICATION_REQUIRED")
                .executed(false)
                .requiresConfirmation(false)
                .clarificationOptions(options)
                .build();
    }

    private WarehouseCategory findWarehouseWithStock(List<InventoryItem> productItems, String text, String defaultName, boolean isSource) {
        if (productItems != null) {
            for (InventoryItem item : productItems) {
                if (item.getStock() != null && item.getStock().compareTo(BigDecimal.ZERO) > 0 && item.getWarehouse() != null) {
                    return item.getWarehouse();
                }
            }
        }
        return resolveWarehouse(text, defaultName, isSource);
    }

    private WarehouseCategory resolveWarehouse(String text, String defaultName, boolean isSource) {
        List<WarehouseCategory> list = warehouseRepository.findAll();
        if (list.isEmpty()) return null;

        String normText = VietnameseSpeechNormalizer.removeVietnameseDiacritics(text).toLowerCase(Locale.ROOT);
        String targetSegment = "";
        if (isSource) {
            Matcher m = Pattern.compile("(?:tu|xuat\\s+kho)\\s+(.+?)(?:sang|den|$)").matcher(normText);
            if (m.find()) targetSegment = m.group(1).trim();
            else targetSegment = normText;
        } else {
            Matcher m = Pattern.compile("(?:sang|den|nhap\\s+kho)\\s+(.+?)$").matcher(normText);
            if (m.find()) targetSegment = m.group(1).trim();
            else targetSegment = normText;
        }

        // 1. Match against targetSegment
        for (WarehouseCategory wh : list) {
            String whNorm = VietnameseSpeechNormalizer.removeVietnameseDiacritics(wh.getName()).toLowerCase(Locale.ROOT);
            if (!targetSegment.isEmpty() && (targetSegment.contains(whNorm) || whNorm.contains(targetSegment))) {
                return wh;
            }
        }

        // 2. Fallback search by defaultName
        String defNorm = VietnameseSpeechNormalizer.removeVietnameseDiacritics(defaultName).toLowerCase(Locale.ROOT);
        for (WarehouseCategory wh : list) {
            String whNorm = VietnameseSpeechNormalizer.removeVietnameseDiacritics(wh.getName()).toLowerCase(Locale.ROOT);
            if (whNorm.contains(defNorm) || defNorm.contains(whNorm)) return wh;
        }

        return isSource ? list.get(0) : (list.size() > 1 ? list.get(1) : list.get(0));
    }

    private ProductCategory resolveBestProductCategory(String rawText, String extractedName, List<ProductCategory> all) {
        if (all == null || all.isEmpty()) return null;
        String normRaw = VietnameseSpeechNormalizer.removeVietnameseDiacritics(rawText != null ? rawText : "").toLowerCase(Locale.ROOT);
        String normTarget = VietnameseSpeechNormalizer.removeVietnameseDiacritics(extractedName != null ? extractedName : "").toLowerCase(Locale.ROOT);

        ProductCategory best = null;
        int bestLen = -1;
        for (ProductCategory p : all) {
            if (p.getName() == null || p.getName().isBlank()) continue;
            String pNorm = VietnameseSpeechNormalizer.removeVietnameseDiacritics(p.getName()).toLowerCase(Locale.ROOT);
            if (p.getName().equalsIgnoreCase(extractedName)) {
                return p;
            }
            if ((normRaw.contains(pNorm) || normTarget.contains(pNorm) || pNorm.contains(normTarget)) && pNorm.length() > bestLen) {
                best = p;
                bestLen = pNorm.length();
            }
        }
        return best;
    }

    private InventoryItem findBestSourceInventoryItem(WarehouseCategory wh, ProductCategory prod, BigDecimal reqQty) {
        if (prod == null) return null;
        List<InventoryItem> candidates;
        if (wh != null) {
            candidates = inventoryRepository.findByWarehouse_IdAndProduct_IdOrderByCreatedAtAscIdAsc(wh.getId(), prod.getId());
        } else {
            candidates = inventoryRepository.findAll().stream()
                    .filter(it -> it.getProduct() != null && Objects.equals(it.getProduct().getId(), prod.getId()))
                    .toList();
        }
        if (candidates.isEmpty()) return null;
        for (InventoryItem item : candidates) {
            if (item.getStock() != null && item.getStock().compareTo(reqQty) >= 0) {
                return item;
            }
        }
        InventoryItem best = candidates.get(0);
        for (InventoryItem item : candidates) {
            BigDecimal s = item.getStock() != null ? item.getStock() : BigDecimal.ZERO;
            BigDecimal bestS = best.getStock() != null ? best.getStock() : BigDecimal.ZERO;
            if (s.compareTo(bestS) > 0) {
                best = item;
            }
        }
        return best;
    }
}
