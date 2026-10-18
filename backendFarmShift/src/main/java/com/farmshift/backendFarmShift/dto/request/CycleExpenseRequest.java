package com.farmshift.backendFarmShift.dto.request;

import com.farmshift.backendFarmShift.entity.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record CycleExpenseRequest(
        @NotNull(message = "Vui lòng chọn ngày chi.") LocalDate expenseDate,
        @NotNull(message = "Vui lòng chọn khoản chi.") ExpenseCategory category,
        @NotNull(message = "Vui lòng nhập số tiền.")
        @DecimalMin(value = "1", message = "Số tiền phải lớn hơn 0.") BigDecimal amount,
        @Size(max = 1000, message = "Ghi chú không quá 1000 ký tự.") String note) {
}
