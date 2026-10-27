package com.farmshift.backendFarmShift.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public record InternalStockVoucherItemRequest(
    Long productId,
    Long inventoryItemId,
    Long unitId,

    @NotNull(message = "Số lượng không được để trống")
    @DecimalMin(value = "0.001", message = "Số lượng phải lớn hơn 0")
    BigDecimal quantity,

    BigDecimal unitPrice,

    @Size(max = 500, message = "Ghi chú dòng không được vượt quá 500 ký tự")
    String note
) {
    public InternalStockVoucherItemRequest(Long productId, Long unitId, BigDecimal quantity, BigDecimal unitPrice, String note) {
        this(productId, null, unitId, quantity, unitPrice, note);
    }
}
