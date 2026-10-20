package com.farmshift.backendFarmShift.dto.request;

import com.farmshift.backendFarmShift.entity.AdministrationMethod;
import com.farmshift.backendFarmShift.entity.ProgramStepCategory;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.List;

public record FarmingProgramRequest(
        @NotBlank(message = "Vui lòng nhập tên chương trình.")
        @Size(max = 150, message = "Tên chương trình không quá 150 ký tự.") String name,
        @NotBlank(message = "Vui lòng nhập giống gà.")
        @Size(max = 100, message = "Tên giống không quá 100 ký tự.") String breed,
        @NotNull(message = "Vui lòng nhập thời gian nuôi.")
        @Min(value = 1, message = "Thời gian nuôi từ 1 đến 365 ngày.")
        @Max(value = 365, message = "Thời gian nuôi từ 1 đến 365 ngày.") Integer durationDays,
        @DecimalMin(value = "0.01", message = "Cân nặng mục tiêu phải lớn hơn 0.")
        @DecimalMax(value = "20", message = "Cân nặng mục tiêu không quá 20 kg.") BigDecimal targetWeightMin,
        @DecimalMin(value = "0.01", message = "Cân nặng mục tiêu phải lớn hơn 0.")
        @DecimalMax(value = "20", message = "Cân nặng mục tiêu không quá 20 kg.") BigDecimal targetWeightMax,
        @Size(max = 1000, message = "Mô tả không quá 1000 ký tự.") String description,
        @NotEmpty(message = "Chương trình cần ít nhất một nội dung.") List<@Valid Step> steps) {

    public record Step(
            @NotNull(message = "Vui lòng chọn nhóm nội dung.") ProgramStepCategory category,
            @NotBlank(message = "Vui lòng nhập tên nội dung.")
            @Size(max = 200, message = "Tên nội dung không quá 200 ký tự.") String name,
            @NotNull(message = "Vui lòng nhập ngày tuổi bắt đầu.")
            @Min(value = 1, message = "Ngày tuổi từ 1 đến 365.") @Max(value = 365, message = "Ngày tuổi từ 1 đến 365.") Integer dayFrom,
            @NotNull(message = "Vui lòng nhập ngày tuổi kết thúc.")
            @Min(value = 1, message = "Ngày tuổi từ 1 đến 365.") @Max(value = 365, message = "Ngày tuổi từ 1 đến 365.") Integer dayTo,
            @DecimalMin(value = "0", message = "Định mức không được âm.") BigDecimal quantity,
            @Size(max = 50, message = "Đơn vị không quá 50 ký tự.") String unit,
            @Min(value = 1, message = "Số cữ ăn từ 1 đến 8.") @Max(value = 8, message = "Số cữ ăn từ 1 đến 8.") Integer mealsPerDay,
            AdministrationMethod method,
            @DecimalMin(value = "10", message = "Nhiệt độ từ 10 đến 45°C.") @DecimalMax(value = "45", message = "Nhiệt độ từ 10 đến 45°C.") BigDecimal tempMin,
            @DecimalMin(value = "10", message = "Nhiệt độ từ 10 đến 45°C.") @DecimalMax(value = "45", message = "Nhiệt độ từ 10 đến 45°C.") BigDecimal tempMax,
            @Size(max = 1000, message = "Ghi chú không quá 1000 ký tự.") String note,
            @Positive(message = "Hàng hóa không hợp lệ.") Long inventoryItemId) {
    }
}
