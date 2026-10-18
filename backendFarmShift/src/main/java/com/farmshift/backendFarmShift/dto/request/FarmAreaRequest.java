package com.farmshift.backendFarmShift.dto.request;

import com.farmshift.backendFarmShift.entity.LivestockType;
import jakarta.validation.constraints.*;
import java.util.List;

public record FarmAreaRequest(
        @NotBlank(message = "Vui lòng nhập tên khu nuôi.")
        @Size(max = 150, message = "Tên khu nuôi không quá 150 ký tự.") String name,
        @NotNull(message = "Vui lòng chọn loại vật nuôi.") LivestockType livestockType,
        @NotNull(message = "Vui lòng chọn số bữa ăn trong ngày.")
        @Min(value = 0, message = "Số bữa ăn trong ngày từ 0 đến 6.")
        @Max(value = 6, message = "Số bữa ăn trong ngày từ 0 đến 6.") Integer mealsPerDay,
        List<String> environmentMetrics,
        List<String> animalMetrics,
        @Size(max = 1000, message = "Ghi chú không quá 1000 ký tự.") String description) {
}
