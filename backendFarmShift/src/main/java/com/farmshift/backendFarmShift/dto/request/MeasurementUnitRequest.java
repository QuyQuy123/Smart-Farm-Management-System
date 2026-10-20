package com.farmshift.backendFarmShift.dto.request;

import com.farmshift.backendFarmShift.entity.UsageUnit;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public record MeasurementUnitRequest(
    @NotBlank(message = "Vui lòng nhập mã đơn vị.") @Size(max = 30, message = "Mã đơn vị không quá 30 ký tự.") String code,
    @NotBlank(message = "Vui lòng nhập tên đơn vị.") @Size(max = 150, message = "Tên đơn vị không quá 150 ký tự.") String name,
    @Size(max = 1000, message = "Mô tả không quá 1000 ký tự.") String description,
    @DecimalMin(value = "0.001", message = "Quy cách phải lớn hơn 0.")
    @Digits(integer = 11, fraction = 3, message = "Quy cách tối đa 11 chữ số và 3 số thập phân.") BigDecimal contentQuantity,
    UsageUnit contentUnit) {
}
