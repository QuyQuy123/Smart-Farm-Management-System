package com.farmshift.backendFarmShift.dto.request;

import com.farmshift.backendFarmShift.entity.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record FlockLossRequest(
        @NotNull(message = "Vui lòng chọn loại ghi nhận.") FlockMovementType type,
        @NotNull(message = "Vui lòng chọn ngày ghi nhận.") LocalDate movementDate,
        @NotNull(message = "Vui lòng nhập số con.")
        @Min(value = 1, message = "Số con phải lớn hơn 0.") Integer quantity,
        @DecimalMin(value = "0", message = "Khối lượng không được âm.") BigDecimal weightKg,
        @Size(max = 1000, message = "Ghi chú không quá 1000 ký tự.") String note,
        @Size(max = 3, message = "Đính kèm tối đa 3 ảnh.")
        List<@NotBlank @Size(max = 500, message = "Đường dẫn ảnh quá dài.")
             @Pattern(regexp = "^(/img/|https://)[^\\s]+$", message = "Đường dẫn ảnh không hợp lệ.") String> photoUrls) {
}
