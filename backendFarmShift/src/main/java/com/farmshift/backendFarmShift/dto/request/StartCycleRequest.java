package com.farmshift.backendFarmShift.dto.request;

import com.farmshift.backendFarmShift.entity.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record StartCycleRequest(
        @NotNull(message = "Vui lòng chọn ngày bắt đầu lứa.") LocalDate startDate,
        LocalDate hatchDate,
        @Size(max = 1000, message = "Ghi chú không quá 1000 ký tự.") String note) {
}
