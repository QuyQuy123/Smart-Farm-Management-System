package com.farmshift.backendFarmShift.dto.request;
import jakarta.validation.constraints.*;
public record TransferCategoryRequest(
    @NotBlank(message="Vui lòng nhập loại phiếu.") @Size(max=150) String type,
    @NotBlank(message="Vui lòng nhập tên danh mục.") @Size(max=150) String name,
    @Size(max=1000) String description) {}
