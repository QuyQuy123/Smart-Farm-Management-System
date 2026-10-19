package com.farmshift.backendFarmShift.dto.request;

import com.farmshift.backendFarmShift.entity.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record FeedRecordRequest(
        @NotNull(message = "Vui lòng chọn ngày cho ăn.") LocalDate recordDate,
        @NotBlank(message = "Vui lòng nhập tên cám.")
        @Size(max = 150, message = "Tên cám không quá 150 ký tự.") String feedName,
        @NotNull(message = "Vui lòng nhập lượng cám.")
        @DecimalMin(value = "0.001", message = "Lượng cám phải lớn hơn 0.") BigDecimal quantityKg,
        @NotNull(message = "Vui lòng nhập đơn giá cám.")
        @DecimalMin(value = "0", message = "Đơn giá cám không được âm.") BigDecimal unitPrice,
        @Size(max = 1000, message = "Ghi chú không quá 1000 ký tự.") String note) {
}
