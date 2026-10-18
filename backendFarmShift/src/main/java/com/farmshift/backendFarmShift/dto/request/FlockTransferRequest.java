package com.farmshift.backendFarmShift.dto.request;

import com.farmshift.backendFarmShift.entity.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record FlockTransferRequest(
        @NotNull(message = "Vui lòng chọn chuồng đích.") Long targetBarnId,
        @NotNull(message = "Vui lòng nhập số con chuyển.")
        @Min(value = 1, message = "Số con chuyển phải lớn hơn 0.") Integer quantity,
        @NotNull(message = "Vui lòng chọn ngày chuyển.") LocalDate transferDate,
        @Size(max = 150, message = "Tên đàn không quá 150 ký tự.") String name,
        @DecimalMin(value = "0.001", message = "Trọng lượng trung bình phải lớn hơn 0.")
        @DecimalMax(value = "500", message = "Trọng lượng trung bình không quá 500 kg/con.") BigDecimal avgWeight,
        @Size(max = 1000, message = "Ghi chú không quá 1000 ký tự.") String note) {
}
