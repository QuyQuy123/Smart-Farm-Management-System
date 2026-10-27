package com.farmshift.backendFarmShift.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record InternalStockCategoryRequest(
    @NotBlank(message = "Loại phiếu không được để trống")
    @Pattern(regexp = "IMPORT|EXPORT|TRANSFER", message = "Loại phiếu phải là IMPORT, EXPORT hoặc TRANSFER")
    String movementType,

    @NotBlank(message = "Tên danh mục không được để trống")
    @Size(max = 150, message = "Tên danh mục không vượt quá 150 ký tự")
    String name,

    @Size(max = 1000, message = "Mô tả không vượt quá 1000 ký tự")
    String description
) {}
