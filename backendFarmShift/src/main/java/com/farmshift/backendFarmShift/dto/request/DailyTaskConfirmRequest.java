package com.farmshift.backendFarmShift.dto.request;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Xác nhận một việc trong phiếu việc của chuồng. actualQuantity để trống nghĩa là làm đúng kế hoạch;
 * chỉ nhập khi làm khác kế hoạch (cùng đơn vị với kế hoạch: kg cám, g / ml thuốc, liều vắc-xin).
 */
public record DailyTaskConfirmRequest(
        @NotNull(message = "Vui lòng chọn ngày.") LocalDate date,
        @NotBlank(message = "Thiếu mã việc.") @Size(max = 120, message = "Mã việc không hợp lệ.") String taskKey,
        @DecimalMin(value = "0", message = "Lượng thực tế không được âm.")
        @Digits(integer = 11, fraction = 3, message = "Lượng thực tế tối đa 11 chữ số và 3 số thập phân.") BigDecimal actualQuantity,
        @Size(max = 1000, message = "Ghi chú không quá 1000 ký tự.") String note) {
}
