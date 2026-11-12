package com.farmshift.backendFarmShift.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record PayrollPayRequest(
        @NotNull(message = "Vui lòng nhập số tiền thanh toán.") @Positive(message = "Số tiền thanh toán phải lớn hơn 0.") Long amount,
        @NotNull(message = "Vui lòng chọn nguồn quỹ chi lương.") Long cashFundId,
        LocalDate paymentDate,
        @Size(max = 500) String note
) {
}

