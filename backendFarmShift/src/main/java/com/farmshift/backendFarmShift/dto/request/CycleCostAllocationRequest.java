package com.farmshift.backendFarmShift.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record CycleCostAllocationRequest(
        Long cycleId,
        @Size(max = 120) String barnName,
        @Size(max = 80) String cycleCode,
        @NotBlank(message = "Vui lòng nhập loại chi phí.") @Size(max = 150) String costType,
        @NotNull(message = "Vui lòng nhập số tiền phân bổ.") @Positive(message = "Số tiền phải lớn hơn 0.") Long amount,
        @Size(max = 80) String sourceVoucherCode,
        @NotNull(message = "Vui lòng chọn ngày ghi nhận.") LocalDate date,
        @Size(max = 500) String note
) {
}

