package com.farmshift.backendFarmShift.dto.response;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record InventoryItemResponse(Long id, Long warehouseId, String warehouseName, Long productId,
    String name, String imageUrl, BigDecimal price, BigDecimal stock, Long brandId, String brandName, LocalDateTime createdAt,
    Long unitId, String unitName, String unitCode,
    BigDecimal unitContentQuantity, com.farmshift.backendFarmShift.entity.UsageUnit unitContentUnit,
    /** Loại hàng hóa (VD: Thức ăn chăn nuôi, Thuốc thú y), dùng để lọc khi chọn cám / thuốc / vắc-xin. */
    String productType) {
}
