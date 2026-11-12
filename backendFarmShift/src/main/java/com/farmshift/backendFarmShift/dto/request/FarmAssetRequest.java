package com.farmshift.backendFarmShift.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record FarmAssetRequest(
        @NotBlank(message = "Vui lòng nhập tên tài sản.") @Size(max = 200) String name,
        @NotNull(message = "Vui lòng nhập nguyên giá tài sản.") @Positive(message = "Nguyên giá phải lớn hơn 0.") Long cost,
        @NotNull(message = "Vui lòng nhập số tháng khấu hao.") @Min(value = 1, message = "Thời gian khấu hao tối thiểu 1 tháng.") Integer depreciationMonths,
        @Size(max = 200) String barnLocation,
        LocalDate purchaseDate,
        @Size(max = 80) String status,
        @Size(max = 500) String note
) {
}

