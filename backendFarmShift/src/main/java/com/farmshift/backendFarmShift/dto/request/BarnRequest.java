package com.farmshift.backendFarmShift.dto.request;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;

/**
 * Số con hiện có và trạng thái không nằm trong request: số con chỉ thay đổi qua nhập đàn, chuyển đàn, hao hụt,
 * xuất bán; trạng thái chuyển theo lứa nuôi (khai báo lứa = đang hoạt động, kết thúc lứa = chưa hoạt động).
 */
public record BarnRequest(
        @NotNull(message = "Vui lòng chọn khu nuôi.") Long areaId,
        @NotBlank(message = "Vui lòng nhập tên chuồng.")
        @Size(max = 100, message = "Tên chuồng không quá 100 ký tự.") String name,
        @NotNull(message = "Vui lòng nhập sức chứa tối đa.")
        @Min(value = 1, message = "Sức chứa tối đa phải lớn hơn 0.")
        @Max(value = 10_000_000, message = "Sức chứa tối đa không quá 10.000.000 con.") Integer capacity,
        @DecimalMin(value = "0.01", message = "Diện tích phải lớn hơn 0.")
        @DecimalMax(value = "1000000", message = "Diện tích không quá 1.000.000 m².") BigDecimal areaM2,
        @Size(max = 1000, message = "Ghi chú không quá 1000 ký tự.") String description) {
}
