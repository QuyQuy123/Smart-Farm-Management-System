package com.farmshift.backendFarmShift.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ProductCategoryRequest(
        @NotBlank(message = "Vui lòng nhập tên danh mục hàng hóa.")
        @Size(max = 150, message = "Tên danh mục không quá 150 ký tự.") String name,
        @Size(max = 1000, message = "Mô tả không quá 1000 ký tự.") String description) {
}
