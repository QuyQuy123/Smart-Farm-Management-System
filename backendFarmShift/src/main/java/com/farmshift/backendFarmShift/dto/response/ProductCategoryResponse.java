package com.farmshift.backendFarmShift.dto.response;

import java.time.LocalDateTime;

public record ProductCategoryResponse(Long id, String code, String name, String description,
                                        String specification, String brand, String productType,
                                        long itemCount, LocalDateTime createdAt, Long warehouseId, String warehouseName) {
}
