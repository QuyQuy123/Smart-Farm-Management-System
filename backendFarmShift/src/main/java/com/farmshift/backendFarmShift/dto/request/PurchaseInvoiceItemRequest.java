package com.farmshift.backendFarmShift.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record PurchaseInvoiceItemRequest(
    Long productCategoryId,
    @NotBlank(message = "Vui lòng nhập tên mặt hàng.") String name,
    @NotNull(message = "Vui lòng nhập số lượng.") @Positive(message = "Số lượng phải lớn hơn 0.") Double qty,
    @NotBlank(message = "Vui lòng nhập đơn vị tính.") String unit,
    @NotNull(message = "Vui lòng nhập đơn giá.") Long price,
    Double vatRate
) {
}
