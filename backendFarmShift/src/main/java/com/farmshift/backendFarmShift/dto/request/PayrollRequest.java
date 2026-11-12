package com.farmshift.backendFarmShift.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record PayrollRequest(
        Long accountId,
        @NotBlank(message = "Vui lòng nhập tên nhân viên.") @Size(max = 150) String employeeName,
        @NotBlank(message = "Vui lòng chọn kỳ lương.") @Size(max = 20) String payPeriod,
        @NotNull(message = "Vui lòng nhập số ngày công.") @Min(value = 0, message = "Ngày công không được âm.") Integer workDays,
        @NotNull(message = "Vui lòng nhập đơn giá ngày công.") @PositiveOrZero(message = "Đơn giá không được âm.") Long dailyRate,
        @PositiveOrZero(message = "Phụ cấp / thưởng không được âm.") Long bonus,
        @PositiveOrZero(message = "Tiền tạm ứng không được âm.") Long advance,
        @Size(max = 500) String note
) {
}

