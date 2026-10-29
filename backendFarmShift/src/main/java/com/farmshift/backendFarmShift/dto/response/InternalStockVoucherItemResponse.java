package com.farmshift.backendFarmShift.dto.response;

import java.math.BigDecimal;

public record InternalStockVoucherItemResponse(
    Long id,
    Long productId,
    String productCode,
    String productName,
    Long unitId,
    String unitName,
    BigDecimal quantity,
    BigDecimal unitPrice,
    BigDecimal amount,
    String note
) {}
