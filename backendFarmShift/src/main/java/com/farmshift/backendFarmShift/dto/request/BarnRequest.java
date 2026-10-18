package com.farmshift.backendFarmShift.dto.request;

import com.farmshift.backendFarmShift.entity.BarnStatus;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;

/** Số con hiện có không nằm trong request: chỉ thay đổi qua nhập đàn, chuyển đàn, hao hụt và xuất bán. */
public record BarnRequest(
        @NotNull(message = "Vui lòng chọn khu nuôi.") Long areaId,
        @NotBlank(message = "Vui lòng nhập tên chuồng.")
        @Size(max = 100, message = "Tên chuồng không quá 100 ký tự.") String name,
        @NotNull(message = "Vui lòng chọn trạng thái hoạt động.") BarnStatus status,
        @NotNull(message = "Vui lòng nhập sức chứa tối đa.")
        @Min(value = 1, message = "Sức chứa tối đa phải lớn hơn 0.")
        @Max(value = 10_000_000, message = "Sức chứa tối đa không quá 10.000.000 con.") Integer capacity,
        @DecimalMin(value = "0.01", message = "Diện tích phải lớn hơn 0.")
        @DecimalMax(value = "1000000", message = "Diện tích không quá 1.000.000 m².") BigDecimal areaM2,
        @DecimalMin(value = "0", message = "Mục tiêu cân nặng không được âm.")
        @DecimalMax(value = "999", message = "Mục tiêu cân nặng không quá 999 kg.")
        @Digits(integer = 3, fraction = 2, message = "Mục tiêu cân nặng tối đa 2 chữ số thập phân.") BigDecimal targetWeight,
        @Size(max = 1000, message = "Ghi chú không quá 1000 ký tự.") String description) {
}
