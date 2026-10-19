package com.farmshift.backendFarmShift.dto.response;

import java.time.LocalDateTime;

public record PurchaseTagResponse(
    Long id,
    String name,
    String color,
    String description,
    long usageCount,
    LocalDateTime createdAt
) {
}
