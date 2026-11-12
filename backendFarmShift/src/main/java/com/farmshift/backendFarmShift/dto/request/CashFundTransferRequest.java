package com.farmshift.backendFarmShift.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record CashFundTransferRequest(
        @NotNull(message = "Vui lòng chọn ngày chuyển quỹ.") LocalDate date,
        @NotNull(message = "Vui lòng chọn quỹ nguồn.") Long fromFundId,
        @NotNull(message = "Vui lòng chọn quỹ đích.") Long toFundId,
        @NotNull(message = "Vui lòng nhập số tiền chuyển.") @Positive(message = "Số tiền chuyển phải lớn hơn 0.") Long amount,
        @Min(value = 0, message = "Phí chuyển không được âm.") Long fee,
        @Size(max = 500) String note
) {
}

