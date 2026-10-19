package com.farmshift.backendFarmShift.dto.response;

import java.time.LocalDateTime;

public record SpecificationResponse(
        Long id,
        String name,
        String unit,
        String items,
        String note,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {
}
