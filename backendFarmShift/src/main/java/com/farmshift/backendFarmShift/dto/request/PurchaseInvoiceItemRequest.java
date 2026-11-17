package com.farmshift.backendFarmShift.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record PurchaseInvoiceItemRequest(
    Long productCategoryId,
    @NotBlank(message = "Vui lòng nhập tên mặt hàng.") @Size(max=200) String name,
    @NotNull(message = "Vui lòng nhập số lượng.") @Positive(message = "Số lượng phải lớn hơn 0.") Double qty,
    @NotBlank(message = "Vui lòng nhập đơn vị tính.") @Size(max=50) String unit,
    @NotNull(message = "Vui lòng nhập đơn giá.") @Positive(message="Đơn giá phải lớn hơn 0.") Long price,
    Double vatRate,
    Long warehouseId
) {
    public PurchaseInvoiceItemRequest(Long productCategoryId, String name, Double qty, String unit, Long price, Double vatRate) {
        this(productCategoryId, name, qty, unit, price, vatRate, null);
    }
}
