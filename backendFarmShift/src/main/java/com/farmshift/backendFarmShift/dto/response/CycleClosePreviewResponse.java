package com.farmshift.backendFarmShift.dto.response;

import java.math.BigDecimal;
import java.util.List;

/**
 * Dữ liệu xem trước khi kết thúc lứa nuôi: cám mở bao còn dư tại chuồng và tồn kho Khu nuôi.
 */
public record CycleClosePreviewResponse(
        Long cycleId,
        int cycleNumber,
        Long barnId,
        String barnName,
        Long areaId,
        String areaName,
        int remainingAnimals,
        int otherActiveCyclesInArea,
        List<OpenedFeedBalance> openedFeeds,
        List<TargetCycleOption> transferTargetCycles,
        List<AreaWarehouseStockItem> areaWarehouseStocks
) {
    public record TargetCycleOption(
            Long cycleId,
            String cycleCode,
            int cycleNumber,
            Long barnId,
            String barnName,
            String areaName
    ) {}

    public record AreaWarehouseStockItem(
            Long warehouseId,
            String warehouseName,
            String warehouseKind,
            Long productId,
            String productName,
            String unitName,
            BigDecimal totalStock,
            BigDecimal totalValue
    ) {}
}
