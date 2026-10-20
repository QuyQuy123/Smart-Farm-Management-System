package com.farmshift.backendFarmShift.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PurchaseTagRequest(
    @NotBlank(message = "Vui lòng nhập tên thẻ phân loại.")
    @Size(max = 100, message = "Tên thẻ không được vượt quá 100 ký tự.")
    String name,

    @NotBlank(message = "Vui lòng chọn màu sắc nhận diện.")
    @Size(max = 30)
    String color,

    @Size(max = 500)
    String description
) {
}
