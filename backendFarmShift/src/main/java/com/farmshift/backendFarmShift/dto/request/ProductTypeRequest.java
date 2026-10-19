package com.farmshift.backendFarmShift.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ProductTypeRequest(
        @NotBlank(message = "Vui lòng nhập tên loại hàng.")
        @Size(max = 150, message = "Tên loại hàng không quá 150 ký tự.") String name,
        @Size(max = 1000, message = "Mô tả không quá 1000 ký tự.") String description,
        @Min(value = 0, message = "Số lượng không được nhỏ hơn 0.") Integer quantity) {
}
