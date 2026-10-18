package com.farmshift.backendFarmShift.dto.request;

import com.farmshift.backendFarmShift.entity.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record FlockImportRequest(
        @NotBlank(message = "Vui lòng nhập tên đàn.")
        @Size(max = 150, message = "Tên đàn không quá 150 ký tự.") String name,
        @NotNull(message = "Vui lòng chọn giới tính đàn.") FlockGender gender,
        @NotNull(message = "Vui lòng chọn ngày nhập.") LocalDate importDate,
        @NotNull(message = "Vui lòng nhập ngày tuổi lúc nhập.")
        @Min(value = 1, message = "Ngày tuổi lúc nhập từ 1 đến 365.")
        @Max(value = 365, message = "Ngày tuổi lúc nhập từ 1 đến 365.") Integer ageAtImport,
        @NotNull(message = "Vui lòng nhập số lượng nhập.")
        @Min(value = 1, message = "Số lượng nhập phải lớn hơn 0.") Integer quantity,
        @NotNull(message = "Vui lòng nhập trọng lượng trung bình.")
        @DecimalMin(value = "0.001", message = "Trọng lượng trung bình phải lớn hơn 0.")
        @DecimalMax(value = "500", message = "Trọng lượng trung bình không quá 500 kg/con.") BigDecimal avgWeight,
        @NotNull(message = "Vui lòng nhập giá con giống.")
        @DecimalMin(value = "0", message = "Giá con giống không được âm.") BigDecimal unitPrice,
        @Size(max = 200, message = "Nguồn nhập không quá 200 ký tự.") String sourceNote,
        @Size(max = 1000, message = "Ghi chú không quá 1000 ký tự.") String note) {
}
