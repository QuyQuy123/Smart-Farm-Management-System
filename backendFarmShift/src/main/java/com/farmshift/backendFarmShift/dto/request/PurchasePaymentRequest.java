package com.farmshift.backendFarmShift.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record PurchasePaymentRequest(
    @NotNull(message = "Vui lòng nhập số tiền thanh toán.")
    @Positive(message = "Số tiền thanh toán phải lớn hơn 0.")
    Long amount,

    String note
) {
}
