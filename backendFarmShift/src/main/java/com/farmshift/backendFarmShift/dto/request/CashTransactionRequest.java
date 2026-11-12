package com.farmshift.backendFarmShift.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record CashTransactionRequest(
        @NotNull(message = "Vui lòng chọn ngày ghi nhận.") LocalDate date,
        @NotBlank(message = "Vui lòng chọn loại phiếu (Thu / Chi).") String type,
        @NotBlank(message = "Vui lòng chọn danh mục thu / chi.") @Size(max = 150) String category,
        @NotNull(message = "Vui lòng nhập số tiền.") @Positive(message = "Số tiền phải lớn hơn 0.") Long amount,
        @Size(max = 100) String contact,
        @NotBlank(message = "Vui lòng nhập người nộp / nhận.") @Size(max = 200) String name,
        @NotNull(message = "Vui lòng chọn nguồn quỹ.") Long fundId,
        @Size(max = 1000) String note
) {
}

