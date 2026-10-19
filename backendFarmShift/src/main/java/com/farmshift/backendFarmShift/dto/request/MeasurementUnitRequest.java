package com.farmshift.backendFarmShift.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record MeasurementUnitRequest(
    @NotBlank(message = "Vui lòng nhập mã đơn vị.") @Size(max = 30, message = "Mã đơn vị không quá 30 ký tự.") String code,
    @NotBlank(message = "Vui lòng nhập tên đơn vị.") @Size(max = 150, message = "Tên đơn vị không quá 150 ký tự.") String name,
    @Size(max = 1000, message = "Mô tả không quá 1000 ký tự.") String description) {
}
