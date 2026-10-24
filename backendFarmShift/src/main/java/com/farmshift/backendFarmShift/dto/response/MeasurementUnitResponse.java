package com.farmshift.backendFarmShift.dto.response;

import java.time.LocalDateTime;

public record MeasurementUnitResponse(Long id, String code, String name, String description,
                                      long itemCount, LocalDateTime createdAt,
                                      java.math.BigDecimal contentQuantity, com.farmshift.backendFarmShift.entity.UsageUnit contentUnit) {
}
