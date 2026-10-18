package com.farmshift.backendFarmShift.dto.response;

import com.farmshift.backendFarmShift.entity.BarnPurpose;
import com.farmshift.backendFarmShift.entity.BarnStatus;
import com.farmshift.backendFarmShift.entity.LivestockType;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/** activeCycleId is null while the barn has no running farming cycle. */
public record BarnResponse(Long id, String code, Long areaId, String areaName, LivestockType livestockType, String name,
                           BarnPurpose purpose, BarnStatus status, int capacity, int currentQuantity, BigDecimal areaM2,
                           BigDecimal targetWeight, String description, Long activeCycleId,
                           LocalDateTime createdAt, LocalDateTime updatedAt) {
}
