package com.farmshift.backendFarmShift.dto.request;

import com.farmshift.backendFarmShift.entity.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record FlockHarvestRequest(
        @NotNull(message = "Vui lòng chọn ngày xuất bán.") LocalDate movementDate,
        @NotNull(message = "Vui lòng nhập số con xuất bán.")
        @Min(value = 1, message = "Số con xuất bán phải lớn hơn 0.") Integer quantity,
        @NotNull(message = "Vui lòng nhập tổng khối lượng xuất bán.")
        @DecimalMin(value = "0.001", message = "Tổng khối lượng phải lớn hơn 0.") BigDecimal weightKg,
        @NotNull(message = "Vui lòng nhập đơn giá bán.")
        @DecimalMin(value = "0", message = "Đơn giá bán không được âm.") BigDecimal unitPrice,
        @Size(max = 1000, message = "Ghi chú không quá 1000 ký tự.") String note) {
}
