package com.farmshift.backendFarmShift.dto.request;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;

public record SalesPaymentRequest(
    @NotBlank @Size(max = 20) String phone,
    @NotNull @Positive @Digits(integer = 17, fraction = 2) BigDecimal amount,
    @NotNull @Positive @Digits(integer = 19, fraction = 2) BigDecimal expectedDebt,
    @NotBlank @Pattern(regexp = "Tiền mặt|Chuyển khoản") String paymentMethod
) {}
