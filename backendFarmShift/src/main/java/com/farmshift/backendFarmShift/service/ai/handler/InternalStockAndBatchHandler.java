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
    private static final NumberFormat CURRENCY_FORMAT = NumberFormat.getInstance(new Locale("vi", "VN"));

    @Override
    public int getOrder() {
        return 30;
    }

    @Override
    public boolean canHandle(AssistantExecutionContext context) {
        if (Boolean.TRUE.equals(context.getConfirmAction())) {
            Map<String, Object> payload = context.getPendingActionPayload();
            return payload != null && "INTERNAL_STOCK_VOUCHER".equals(payload.get("actionType"));
        }

        String msg = context.getMessage();
        if (msg == null || msg.isBlank()) return false;
        String norm = VietnameseSpeechNormalizer.removeVietnameseDiacritics(msg).toLowerCase();

        // 1. Batch price inquiry signals (exclude low-stock threshold alerts which route to QUERY_FARM_STATUS)
        boolean isLowStockAlert = norm.contains("sap het") || norm.contains("sap can")
                || norm.contains("ton thap") || norm.contains("duoi ");
        boolean isBatchQuery = !isLowStockAlert
                && (norm.contains("ton kho") || norm.contains("trong kho") || norm.contains("kiem tra ton"))
                && (norm.contains("gia") || norm.contains("dot") || norm.contains("chi tiet") || norm.contains("lo") || norm.contains("bao nhieu"));

        // 2. Internal movement signals (only EXPORT & TRANSFER)
        boolean isMovement = norm.contains("xuat huy") || norm.contains("chuyen kho")
                || norm.contains("phieu xuat huy") || norm.contains("phieu chuyen kho")
                || (norm.contains("chuyen") && norm.contains("kho") && norm.contains("sang"));

        return isBatchQuery || isMovement;
    }

    @Override
    @Transactional
    public AiAssistantResponse handle(AssistantExecutionContext context) {
        if (Boolean.TRUE.equals(context.getConfirmAction())) {
            return executeConfirmedVoucher(context);
        }

        String msg = context.getMessage();
        String norm = VietnameseSpeechNormalizer.removeVietnameseDiacritics(msg).toLowerCase();

        if (norm.contains("xuat huy") || norm.contains("chuyen kho")
                || (norm.contains("chuyen") && norm.contains("kho") && norm.contains("sang"))) {
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
            Set<Long> allowedBarnIds = workAssignmentService.barnIdsOf(context.getUsername());
            if (!allowedBarnIds.isEmpty()) {
                Set<Long> allowedAreaIds = new HashSet<>();
                for (Barn b : barnRepository.findAll()) {
                    if (allowedBarnIds.contains(b.getId()) && b.getArea() != null && b.getArea().getId() != null) {
                        allowedAreaIds.add(b.getArea().getId());
                    }
                }
                Set<Long> allowedWarehouseIds = new HashSet<>();
                for (Long areaId : allowedAreaIds) {
                    warehouseRepository.findAllByArea_Id(areaId).forEach(w -> allowedWarehouseIds.add(w.getId()));
                }
                if (!allowedWarehouseIds.isEmpty()) {
                    allItems = allItems.stream()
                            .filter(i -> i.getWarehouse() != null && allowedWarehouseIds.contains(i.getWarehouse().getId()))
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
                String priceStr = CURRENCY_FORMAT.format(item.getPrice() != null ? item.getPrice() : BigDecimal.ZERO) + " VNĐ";
                sb.append("| ").append(item.getProduct().getName())
                        .append(" | `").append(batchCode).append("`")
                        .append(" | ").append(stockStr)
                        .append(" | ").append(priceStr).append(" |\n");
            }

            if (singleUnit != null) {
                sb.append("\n- **Tổng tồn kho:** ").append(formatQty(totalStock)).append(" ").append(singleUnit);
                sb.append("\n- **Giá TB (Bình quân gia quyền):** ").append(CURRENCY_FORMAT.format(weightedAvgPrice)).append(" VNĐ/").append(singleUnit);
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
        String norm = VietnameseSpeechNormalizer.removeVietnameseDiacritics(msg).toLowerCase();

        String movementType;
        String categoryName;
        if (norm.contains("xuat huy") || norm.contains("tieu huy") || Pattern.compile("\\bhuy\\b").matcher(norm).find()) {
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

        // Resolve Warehouses
        WarehouseCategory sourceWh = resolveWarehouse(msg, "Kho cám", true);
        WarehouseCategory targetWh = resolveWarehouse(msg, "Kho Khu B", false);

        // Resolve Product & Quantity
        String productName = extractFeedName(msg, "Higro 01");
        double qtyBags = extractQuantityBags(msg);
        if (qtyBags <= 0) qtyBags = 2.0;

        ProductCategory product = resolveProductCategory(productName);
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

        Map<String, Object> details = new LinkedHashMap<>();
        details.put("Loại phiếu", categoryName + " (" + movementType + ")");
        if ("TRANSFER".equals(movementType)) {
            details.put("Kho xuất → Kho nhập", (sourceWh != null ? sourceWh.getName() : "Kho cám") + " → " + (targetWh != null ? targetWh.getName() : "Kho Khu B"));
        } else {
            details.put("Kho xuất", sourceWh != null ? sourceWh.getName() : "Kho cám");
        }
        details.put("Mặt hàng & Lô áp dụng", (product != null ? product.getName() : productName) + " `" + batchCode + "` (" + qtyBags + " bao)");
        details.put("Tồn kho sau thao tác", stockAfter + " bao (Giảm " + qtyBags + " bao)");

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
                .reply("Bạn có muốn tạo phiếu **" + categoryName + "** cho **" + qtyBags + " bao " + (product != null ? product.getName() : productName) + "** không?")
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
        return fallback;
    }

    private double extractQuantityBags(String text) {
        // Match "X bao"
        Matcher bagMatcher = Pattern.compile("(\\d+(?:[.,]\\d+)?)\\s*bao").matcher(text);
        if (bagMatcher.find()) {
            try {
                return Double.parseDouble(bagMatcher.group(1).replace(",", "."));
            } catch (Exception ignored) {}
        }
        // Match "Y kg" (where speech normalizer converted "N bao" to "N*25 kg")
        Matcher kgMatcher = Pattern.compile("(\\d+(?:[.,]\\d+)?)\\s*(?:kg|cân)").matcher(text);
        if (kgMatcher.find()) {
            try {
                double kg = Double.parseDouble(kgMatcher.group(1).replace(",", "."));
                return kg / 25.0; // 1 bao = 25kg
            } catch (Exception ignored) {}
        }
        Matcher m = Pattern.compile("(\\d+(?:[.,]\\d+)?)").matcher(text);
        if (m.find()) {
            try {
                return Double.parseDouble(m.group(1).replace(",", "."));
            } catch (Exception ignored) {}
        }
        return 0.0;
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

    private ProductCategory resolveProductCategory(String name) {
        String normTarget = VietnameseSpeechNormalizer.removeVietnameseDiacritics(name).toLowerCase(Locale.ROOT);
        List<ProductCategory> all = productCategoryRepository.findAll();
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
