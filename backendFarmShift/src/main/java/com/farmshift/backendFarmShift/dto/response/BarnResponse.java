package com.farmshift.backendFarmShift.dto.response;

import com.farmshift.backendFarmShift.entity.BarnPurpose;
import com.farmshift.backendFarmShift.entity.BarnStatus;
import java.math.BigDecimal;
import java.time.LocalDateTime;

public record BarnResponse(Long id, String code, Long areaId, String areaName, String name, BarnPurpose purpose,
                           BarnStatus status, int capacity, int currentQuantity, BigDecimal targetWeight,
                           String description, LocalDateTime createdAt, LocalDateTime updatedAt) {
}
