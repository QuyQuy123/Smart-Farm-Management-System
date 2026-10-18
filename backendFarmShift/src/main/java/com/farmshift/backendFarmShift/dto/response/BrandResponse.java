package com.farmshift.backendFarmShift.dto.response;

import java.time.LocalDateTime;

public record BrandResponse(
        Long id,
        String code,
        String name,
        String productType,
        int quantity,
        String note,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {
}
