package com.farmshift.backendFarmShift.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SpecificationRequest(
        @NotBlank(message = "Vui lòng nhập tên quy cách.")
        @Size(max = 150, message = "Tên quy cách không quá 150 ký tự.") String name,
        @Size(max = 150, message = "Đơn vị không quá 150 ký tự.") String unit,
        @Size(max = 150, message = "Giá trị quy đổi không quá 150 ký tự.") String items,
        @Size(max = 1000, message = "Mô tả không quá 1000 ký tự.") String note) {
}
