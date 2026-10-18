package com.farmshift.backendFarmShift.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ProductCategoryRequest(
        @NotBlank(message = "Vui lòng nhập tên hàng hóa.")
        @Size(max = 150, message = "Tên hàng hóa không quá 150 ký tự.") String name,
        @Size(max = 1000, message = "Mô tả không quá 1000 ký tự.") String description,
        @Size(max = 150, message = "Quy cách không quá 150 ký tự.") String specification,
        @Size(max = 150, message = "Nhãn hiệu không quá 150 ký tự.") String brand,
        @Size(max = 150, message = "Loại hàng hóa không quá 150 ký tự.") String productType,
        @jakarta.validation.constraints.NotNull(message = "Vui lòng chọn kho.")
        @jakarta.validation.constraints.Positive Long warehouseId) {
}
