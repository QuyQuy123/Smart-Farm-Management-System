package com.farmshift.backendFarmShift.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record RoutineTaskCheckRequest(
        @NotNull(message = "Vui lòng chọn ngày làm việc.") LocalDate date,
        @NotBlank(message = "Vui lòng chọn công việc.") String taskCode,
        @Size(max = 500, message = "Ghi chú không quá 500 ký tự.") String note
) {}
