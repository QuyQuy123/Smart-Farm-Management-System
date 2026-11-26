package com.farmshift.backendFarmShift.dto.request;

import jakarta.validation.constraints.*;
import java.time.LocalDate;

public record CycleDiseaseRequest(
        @Positive(message = "Đàn không hợp lệ.") Long flockId,
        @NotBlank(message = "Vui lòng nhập tên bệnh.")
        @Size(max = 200, message = "Tên bệnh không quá 200 ký tự.") String diseaseName,
        @Size(max = 1000, message = "Triệu chứng không quá 1000 ký tự.") String symptoms,
        @NotNull(message = "Vui lòng chọn ngày phát hiện bệnh.") LocalDate startDate,
        @Min(value = 1, message = "Số con bị bệnh phải lớn hơn 0.") Integer affectedQuantity,
        @Size(max = 1000, message = "Ghi chú không quá 1000 ký tự.") String note
) { }
