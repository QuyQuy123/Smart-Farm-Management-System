package com.farmshift.backendFarmShift.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.time.LocalDate;

public record PurchasePaymentRequest(
    @NotNull(message = "Vui lòng nhập số tiền thanh toán.")
    @Positive(message = "Số tiền thanh toán phải lớn hơn 0.")
    Long amount,

    String note,

    String paymentMethod,

    LocalDate paymentDate
) {
    public PurchasePaymentRequest(Long amount, String note) {
        this(amount, note, null, null);
    }
}
