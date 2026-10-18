package com.farmshift.backendFarmShift.dto.response;

import java.time.LocalDateTime;

public record ProductTypeResponse(
        Long id,
        String code,
        String name,
        String description,
        int quantity,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {
}
