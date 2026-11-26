package com.farmshift.backendFarmShift.dto.response;

import java.math.BigDecimal;

/**
 * Tồn cám mở bao còn lại tại chuồng (tính theo kg). remainingValue là null với công nhân.
 */
public record OpenedFeedBalance(
        Long id,
        Long productId,
        String feedName,
        Long warehouseId,
        String warehouseName,
        String unitName,
        BigDecimal kgPerBag,
        BigDecimal remainingKg,
        BigDecimal remainingValue
) {}
