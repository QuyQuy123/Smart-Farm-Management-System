package com.farmshift.backendFarmShift.dto.response;

import java.time.LocalDateTime;

public record InternalStockCategoryResponse(
    Long id,
    String movementType,
    String name,
    String description,
    boolean isSystem,
    long voucherCount,
    LocalDateTime createdAt
) {}
