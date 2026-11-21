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
                    + "|\\b(?:chuyen|dieu\\s+chuyen)\\b.{0,60}\\b(?:tu\\s+kho\\b.{0,45}\\bsang\\s+kho|kho\\b.{0,45}\\bsang\\s+kho)\\b"
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
                || scrubbed.matches(".*\\bhuy\\s+\\d+(?:[.,]\\d+)?\\s*(?:bao|kg|ki|ky|lo|chai|goi|thung|don\\s+vi)\\b.*");
        boolean isTransfer = TRANSFER_EXPLICIT_PATTERN.matcher(scrubbed).find();
        return isDisposal || isTransfer;
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

        // 1. Batch price inquiry signals (exclude low-stock threshold alerts which route to QUERY_FARM_STATUS)
        boolean isLowStockAlert = norm.contains("sap het") || norm.contains("sap can")
                || norm.contains("ton thap") || norm.contains("duoi ");
        boolean isBatchQuery = !isLowStockAlert
                && (norm.contains("ton kho") || norm.contains("trong kho") || norm.contains("kiem tra ton"))
                && (norm.contains("gia") || norm.contains("dot") || norm.contains("chi tiet") || norm.contains("lo") || norm.contains("bao nhieu"));

        // 2. Internal movement signals (only EXPORT & TRANSFER with strict word boundaries)
        boolean isMovement = isInternalStockMovementIntent(norm);

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

        if (isInternalStockMovementIntent(norm)) {
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
            }

            if (!allowedWarehouseIds.isEmpty()) {
                allItems = allItems.stream()
                        .filter(i -> i.getWarehouse() != null && allowedWarehouseIds.contains(i.getWarehouse().getId()))
                        .toList();
            } else {
                // Fail-closed for area-bound warehouses when worker has no assigned barns or area warehouses
                allItems = allItems.stream()
                        .filter(i -> i.getWarehouse() != null && !areaBoundWarehouseIds.contains(i.getWarehouse().getId()))
                        .toList();
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
        Set<String> distinctProducts = new LinkedHashSet<>();
        Set<String> distinctUnits = new LinkedHashSet<>();

        for (InventoryItem item : matchedItems) {
            distinctProducts.add(item.getProduct().getName());
            String rowUnit = item.getUnit() != null ? item.getUnit().getName() : "đơn vị";
            distinctUnits.add(rowUnit);
            BigDecimal stock = item.getStock() != null ? item.getStock() : BigDecimal.ZERO;
            BigDecimal price = item.getPrice() != null ? item.getPrice() : BigDecimal.ZERO;
            totalStock = totalStock.add(stock);
            totalValue = totalValue.add(stock.multiply(price));
        }

        String headerTitle = distinctProducts.size() == 1
                ? distinctProducts.iterator().next()
                : (searchTarget.isBlank() ? "Tất cả vật tư kho" : searchTarget);
        String singleUnit = distinctUnits.size() == 1 ? distinctUnits.iterator().next() : null;

        BigDecimal weightedAvgPrice = BigDecimal.ZERO;
        if (totalStock.compareTo(BigDecimal.ZERO) > 0) {
            weightedAvgPrice = totalValue.divide(totalStock, 0, RoundingMode.HALF_UP);
        }

        StringBuilder sb = new StringBuilder();
        if (canSeeFinance) {
            sb.append("📦 **Báo cáo tồn kho & chi tiết lô giá nhập: ").append(headerTitle).append("**\n\n");
            sb.append("| Mặt hàng | Mã lô (#date-time) | Tồn kho | Đơn giá nhập |\n");
            sb.append("| :--- | :--- | :--- | :--- |\n");

            for (InventoryItem item : matchedItems) {
                String batchCode = formatBatchCode(item);
                String rowUnit = item.getUnit() != null ? item.getUnit().getName() : "đơn vị";
                String stockStr = formatQty(item.getStock()) + " " + rowUnit;
                String priceStr = formatCurrency(item.getPrice() != null ? item.getPrice() : BigDecimal.ZERO) + " VNĐ";
                sb.append("| ").append(item.getProduct().getName())
                        .append(" | `").append(batchCode).append("`")
                        .append(" | ").append(stockStr)
                        .append(" | ").append(priceStr).append(" |\n");
            }

            if (singleUnit != null) {
                sb.append("\n- **Tổng tồn kho:** ").append(formatQty(totalStock)).append(" ").append(singleUnit);
                sb.append("\n- **Giá TB (Bình quân gia quyền):** ").append(formatCurrency(weightedAvgPrice)).append(" VNĐ/").append(singleUnit);
            } else {
                sb.append("\n- **Tổng số lô hiển thị:** ").append(matchedItems.size()).append(" lô");
            }
        } else {
            // ROLE_FARM_WORKER: Price columns COMPLETELY MASKED/STRIPPED
            sb.append("📦 **Báo cáo tồn kho theo lô: ").append(headerTitle).append("**\n\n");
            sb.append("| Mặt hàng | Mã lô (#date-time) | Tồn kho khả dụng |\n");
            sb.append("| :--- | :--- | :--- |\n");

            for (InventoryItem item : matchedItems) {
                String batchCode = formatBatchCode(item);
                String rowUnit = item.getUnit() != null ? item.getUnit().getName() : "đơn vị";
                String stockStr = formatQty(item.getStock()) + " " + rowUnit;
                sb.append("| ").append(item.getProduct().getName())
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
                || scrubbed.matches(".*\\bhuy\\s+\\d+(?:[.,]\\d+)?\\s*(?:bao|kg|ki|ky|lo|chai|goi|thung|don\\s+vi)\\b.*")) {
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

        // Resolve Warehouses & Product & Quantity — ask for Clarification if incomplete/ambiguous
        List<ProductCategory> allProducts = productCategoryRepository.findAll();
        Double parsedQtyBags = extractQuantityBagsOrNull(msg);
        boolean hasSpecificProduct = mentionsSpecificProduct(norm, allProducts);

        if (parsedQtyBags == null || parsedQtyBags <= 0 || !hasSpecificProduct) {
            return buildInternalMovementClarification(movementType, categoryName);
        }

        double qtyBags = parsedQtyBags;
        WarehouseCategory sourceWh = resolveWarehouse(msg, "Kho cám", true);
        WarehouseCategory targetWh = resolveWarehouse(msg, "Kho Khu B", false);

        String productName = extractFeedName(msg, "Cám Higro 01");
        ProductCategory product = resolveProductCategory(productName, allProducts);
        InventoryItem sourceItem = findSourceInventoryItem(sourceWh, product);
        if (sourceItem != null) {
            sourceWh = sourceItem.getWarehouse();
            product = sourceItem.getProduct();
        }

        if ("TRANSFER".equals(movementType) && sourceWh != null && targetWh != null && Objects.equals(sourceWh.getId(), targetWh.getId())) {
            List<WarehouseCategory> allWh = warehouseRepository.findAll();
            for (WarehouseCategory w : allWh) {
                if (!Objects.equals(w.getId(), sourceWh.getId())) {
                    targetWh = w;
                    break;
                }
            }
        }

        // Pre-Flight Stock Check (MSG27)
        if (sourceItem != null && sourceItem.getStock() != null && ("EXPORT".equals(movementType) || "TRANSFER".equals(movementType))) {
            double currentStock = sourceItem.getStock().doubleValue();
            if (qtyBags > currentStock) {
                return AiAssistantResponse.builder()
                        .reply("⚠️ Tồn kho khả dụng không đủ. Giao dịch này sẽ làm cho số dư tồn kho bị âm (Hiện có: "
                                + currentStock + " Bao, Yêu cầu: " + qtyBags + " Bao). Vui lòng kiểm tra lại.")
                        .actionType("STOCK_INSUFFICIENT")
                        .executed(false)
                        .build();
            }
        }

        // Prepare Confirmation Card
        String batchCode = sourceItem != null ? formatBatchCode(sourceItem) : "#" + LocalDateTime.now(CycleService.VN_ZONE).format(BATCH_CODE_FORMATTER);
        double stockBefore = sourceItem != null && sourceItem.getStock() != null ? sourceItem.getStock().doubleValue() : 50.0;
        double stockAfter = Math.max(0.0, stockBefore - qtyBags);
        String qtyDisplay = formatQty(BigDecimal.valueOf(qtyBags));
        String stockAfterDisplay = formatQty(BigDecimal.valueOf(stockAfter));
        String unitLabel = (sourceItem != null && sourceItem.getUnit() != null && sourceItem.getUnit().getName() != null && !sourceItem.getUnit().getName().isBlank())
                ? (sourceItem.getUnit().getName().toLowerCase(Locale.ROOT).contains("bao") ? "bao" : sourceItem.getUnit().getName())
                : "bao";

        Map<String, Object> details = new LinkedHashMap<>();
        details.put("Loại phiếu", categoryName);
        if ("TRANSFER".equals(movementType)) {
            details.put("Kho xuất → Kho nhập", (sourceWh != null ? sourceWh.getName() : "Kho cám") + " → " + (targetWh != null ? targetWh.getName() : "Kho Khu B"));
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
        double quantity = payload.get("quantity") != null ? ((Number) payload.get("quantity")).doubleValue() : 1.0;
        String productName = (String) payload.get("productName");

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
            summary.put("detail", categoryName + " " + quantity + " bao " + productName);
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
        if (qty == null) return "0";
        return qty.stripTrailingZeros().toPlainString();
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
        // Match "X bao / lo / chai / goi / thung"
        Matcher unitMatcher = Pattern.compile("(\\d+(?:[.,]\\d+)?)\\s*(?:bao|lo|chai|goi|thung|don\\s+vi)\\b").matcher(norm);
        if (unitMatcher.find()) {
            try {
                return Double.parseDouble(unitMatcher.group(1).replace(",", "."));
            } catch (Exception ignored) {}
        }
        // Match "Y kg / ki / ky / can" (1 bao = 25kg)
        Matcher kgMatcher = Pattern.compile("(\\d+(?:[.,]\\d+)?)\\s*(?:kg|ki|ky|can|kilogram)\\b").matcher(norm);
        if (kgMatcher.find()) {
            try {
                double kg = Double.parseDouble(kgMatcher.group(1).replace(",", "."));
                return kg / 25.0;
            } catch (Exception ignored) {}
        }
        // Only allow unitless number when it immediately follows the movement verb
        Matcher verbNumMatcher = Pattern.compile("(?:xuat\\s+huy|tieu\\s+huy|chuyen\\s+kho|dieu\\s+chuyen)\\s+(\\d+(?:[.,]\\d+)?)\\b").matcher(norm);
        if (verbNumMatcher.find()) {
            try {
                return Double.parseDouble(verbNumMatcher.group(1).replace(",", "."));
            } catch (Exception ignored) {}
        }
        return null;
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

    private AiAssistantResponse buildInternalMovementClarification(String movementType, String categoryName) {
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
                opt.put("label", "📦 Xuất hủy ... bao/đơn vị " + pName);
                opt.put("description", "Đang tồn " + formatQty(item.getStock()) + " " + unitName + " tại " + whName);
                opt.put("prompt", "Xuất hủy ... bao " + pName);
                opt.put("autoSend", false);
                options.add(opt);
                if (options.size() >= 3) break;
            }
            if (options.isEmpty()) {
                Map<String, Object> fallbackOpt = new LinkedHashMap<>();
                fallbackOpt.put("badge", "Xuất hủy");
                fallbackOpt.put("label", "📦 Tạo phiếu Xuất hủy (điền số lượng & tên vật tư)");
                fallbackOpt.put("description", "Điền số bao và mặt hàng cần xuất hủy để AI lập thẻ xác nhận");
                fallbackOpt.put("prompt", "Xuất hủy ... bao cám Higro 01");
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
                opt.put("label", "🔄 Chuyển ... bao " + pName + " (" + srcWh + " → " + dstWh + ")");
                opt.put("description", "Đang tồn " + formatQty(item.getStock()) + " " + unitName + " tại " + srcWh);
                opt.put("prompt", "Chuyển ... bao " + pName + " từ " + srcWh + " sang " + dstWh);
                opt.put("autoSend", false);
                options.add(opt);
                if (options.size() >= 3) break;
            }
            if (options.isEmpty()) {
                Map<String, Object> fallbackOpt = new LinkedHashMap<>();
                fallbackOpt.put("badge", "Chuyển kho");
                fallbackOpt.put("label", "🔄 Tạo phiếu Chuyển kho (điền số lượng & tên vật tư)");
                fallbackOpt.put("description", "Từ " + sourceName + " sang " + targetName);
                fallbackOpt.put("prompt", "Chuyển ... bao cám Higro 02 từ " + sourceName + " sang " + targetName);
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
                .reply("🤔 Bạn muốn lập phiếu **" + categoryName + "** nhưng câu lệnh chưa nêu rõ **mặt hàng hoặc số lượng cụ thể**.\n"
                        + "Để tránh tạo nhầm phiếu kho, vui lòng chọn đúng mặt hàng bên dưới hoặc gõ rõ số lượng:")
                .actionType("CLARIFICATION_REQUIRED")
                .executed(false)
                .requiresConfirmation(false)
                .clarificationOptions(options)
                .build();
    }

    private WarehouseCategory resolveWarehouse(String text, String defaultName, boolean isSource) {
        List<WarehouseCategory> list = warehouseRepository.findAll();
        if (list.isEmpty()) return null;

        String normText = VietnameseSpeechNormalizer.removeVietnameseDiacritics(text).toLowerCase();
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
            String whNorm = VietnameseSpeechNormalizer.removeVietnameseDiacritics(wh.getName()).toLowerCase();
            if (!targetSegment.isEmpty() && (targetSegment.contains(whNorm) || whNorm.contains(targetSegment))) {
                return wh;
            }
        }

        // 2. Keyword matching for common source vs target warehouse patterns
        for (WarehouseCategory wh : list) {
            String whNorm = VietnameseSpeechNormalizer.removeVietnameseDiacritics(wh.getName()).toLowerCase();
            if (isSource && whNorm.contains("cam") && (targetSegment.contains("cam") || normText.contains("cam"))) {
                return wh;
            }
            if (!isSource && (whNorm.contains("khu b") || whNorm.contains("b")) && (targetSegment.contains("khu b") || normText.contains("khu b"))) {
                return wh;
            }
        }

        // 3. Fallback search by defaultName
        String defNorm = VietnameseSpeechNormalizer.removeVietnameseDiacritics(defaultName).toLowerCase();
        for (WarehouseCategory wh : list) {
            String whNorm = VietnameseSpeechNormalizer.removeVietnameseDiacritics(wh.getName()).toLowerCase();
            if (whNorm.contains(defNorm) || defNorm.contains(whNorm)) return wh;
        }

        return isSource ? list.get(0) : (list.size() > 1 ? list.get(1) : list.get(0));
    }

    private ProductCategory resolveProductCategory(String name, List<ProductCategory> all) {
        String normTarget = VietnameseSpeechNormalizer.removeVietnameseDiacritics(name).toLowerCase(Locale.ROOT);
        for (ProductCategory p : all) {
            String pNorm = VietnameseSpeechNormalizer.removeVietnameseDiacritics(p.getName()).toLowerCase(Locale.ROOT);
            if (p.getName().equalsIgnoreCase(name) || normTarget.contains(pNorm) || pNorm.contains(normTarget)) {
                return p;
            }
        }
        return all.isEmpty() ? null : all.get(0);
    }

    private InventoryItem findSourceInventoryItem(WarehouseCategory wh, ProductCategory prod) {
        if (prod == null) return null;
        if (wh != null) {
            List<InventoryItem> items = inventoryRepository.findByWarehouse_IdAndProduct_IdOrderByCreatedAtAscIdAsc(wh.getId(), prod.getId());
            if (!items.isEmpty()) return items.get(0);
        }
        List<InventoryItem> all = inventoryRepository.findAll();
        for (InventoryItem it : all) {
            if (it.getProduct() != null && it.getProduct().getId().equals(prod.getId())) {
                return it;
            }
        }
        return null;
    }
}
