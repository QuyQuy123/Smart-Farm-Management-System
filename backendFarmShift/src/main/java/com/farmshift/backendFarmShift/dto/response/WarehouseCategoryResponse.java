package com.farmshift.backendFarmShift.dto.response;

import java.time.LocalDateTime;

public record WarehouseCategoryResponse(Long id, String code, String name, String description,
                                        long itemCount, LocalDateTime createdAt) {
}
