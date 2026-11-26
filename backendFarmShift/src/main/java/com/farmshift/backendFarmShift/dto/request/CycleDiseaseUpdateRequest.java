package com.farmshift.backendFarmShift.dto.request;

import com.farmshift.backendFarmShift.entity.DiseaseStatus;
import jakarta.validation.constraints.*;
import java.time.LocalDate;

public record CycleDiseaseUpdateRequest(
        @Size(max = 200, message = "Tên bệnh không quá 200 ký tự.") String diseaseName,
        @Size(max = 1000, message = "Triệu chứng không quá 1000 ký tự.") String symptoms,
        DiseaseStatus status,
        LocalDate endDate,
        @Min(value = 1, message = "Số con bị bệnh phải lớn hơn 0.") Integer affectedQuantity,
        @Size(max = 1000, message = "Ghi chú không quá 1000 ký tự.") String note
) { }
