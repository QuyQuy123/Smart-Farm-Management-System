package com.farmshift.backendFarmShift.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

public record WorkTaskCheckRequest(
        @NotNull(message = "Vui lòng chọn ngày.") LocalDate date,
        @Size(max = 1000, message = "Ghi chú không quá 1000 ký tự.") String note) {
}
