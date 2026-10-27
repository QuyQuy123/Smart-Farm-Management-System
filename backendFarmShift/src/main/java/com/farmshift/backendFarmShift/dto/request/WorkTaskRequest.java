package com.farmshift.backendFarmShift.dto.request;

import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.time.LocalTime;

/** Giao việc cho công nhân phụ trách chuồng. endDate để trống là việc trong một ngày; có endDate là lặp mỗi ngày đến ngày đó. */
public record WorkTaskRequest(
        @NotNull(message = "Vui lòng chọn chuồng.") Long barnId,
        @NotNull(message = "Vui lòng chọn công nhân.") Long assigneeId,
        @NotBlank(message = "Vui lòng nhập tên công việc.") @Size(max = 200, message = "Tên công việc không quá 200 ký tự.") String title,
        @Size(max = 1000, message = "Ghi chú không quá 1000 ký tự.") String note,
        @NotNull(message = "Vui lòng chọn ngày làm.") LocalDate startDate,
        LocalDate endDate,
        LocalTime dueTime) {
}
