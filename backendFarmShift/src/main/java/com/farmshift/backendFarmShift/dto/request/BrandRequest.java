package com.farmshift.backendFarmShift.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record BrandRequest(
        @NotBlank(message = "Vui lòng nhập tên nhãn hiệu.")
        @Size(max = 150, message = "Tên nhãn hiệu không quá 150 ký tự.") String name,
        @Size(max = 150, message = "Loại hàng hóa không quá 150 ký tự.") String productType,
        @Min(value = 0, message = "Số lượng không được nhỏ hơn 0.") Integer quantity,
        @Size(max = 1000, message = "Ghi chú không quá 1000 ký tự.") String note) {
}
