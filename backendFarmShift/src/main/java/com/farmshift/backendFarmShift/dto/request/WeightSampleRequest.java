package com.farmshift.backendFarmShift.dto.request;

import com.farmshift.backendFarmShift.entity.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record WeightSampleRequest(
        @NotNull(message = "Vui lòng chọn ngày cân.") LocalDate sampleDate,
        @NotNull(message = "Vui lòng nhập trọng lượng trung bình.")
        @DecimalMin(value = "0.001", message = "Trọng lượng trung bình phải lớn hơn 0.")
        @DecimalMax(value = "500", message = "Trọng lượng trung bình không quá 500 kg/con.") BigDecimal avgWeightKg,
        @Min(value = 1, message = "Số con cân mẫu phải lớn hơn 0.") Integer sampleSize,
        @Size(max = 1000, message = "Ghi chú không quá 1000 ký tự.") String note) {
}
