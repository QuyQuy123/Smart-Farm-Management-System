package com.farmshift.backendFarmShift.dto.request;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record DiseaseTreatmentCostRequest(
        @NotNull(message = "Vui lòng nhập chi phí thuốc.")
        @DecimalMin(value = "0", message = "Chi phí thuốc không được âm.")
        @DecimalMax(value = "99999999999999", message = "Chi phí thuốc vượt giới hạn cho phép.")
        BigDecimal manualCost
) { }
