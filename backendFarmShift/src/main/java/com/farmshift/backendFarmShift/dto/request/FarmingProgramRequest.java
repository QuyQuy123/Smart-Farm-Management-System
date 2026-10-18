package com.farmshift.backendFarmShift.dto.request;

import com.farmshift.backendFarmShift.entity.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record FarmingProgramRequest(
        @NotBlank(message = "Vui lòng nhập tên chương trình.")
        @Size(max = 150, message = "Tên chương trình không quá 150 ký tự.") String name,
        @NotNull(message = "Vui lòng chọn loại chương trình.") ProgramType type,
        @Size(max = 1000, message = "Mô tả không quá 1000 ký tự.") String description,
        @NotEmpty(message = "Chương trình cần ít nhất một nội dung.") List<@Valid Step> steps) {

    public record Step(
            @NotBlank(message = "Vui lòng nhập tên nội dung.")
            @Size(max = 200, message = "Tên nội dung không quá 200 ký tự.") String name,
            @NotNull(message = "Vui lòng nhập ngày tuổi bắt đầu.")
            @Min(value = 1, message = "Ngày tuổi từ 1 đến 365.") @Max(value = 365, message = "Ngày tuổi từ 1 đến 365.") Integer dayFrom,
            @NotNull(message = "Vui lòng nhập ngày tuổi kết thúc.")
            @Min(value = 1, message = "Ngày tuổi từ 1 đến 365.") @Max(value = 365, message = "Ngày tuổi từ 1 đến 365.") Integer dayTo,
            @DecimalMin(value = "0", message = "Định mức không được âm.") BigDecimal quantity,
            @Size(max = 50, message = "Đơn vị không quá 50 ký tự.") String unit,
            @Size(max = 1000, message = "Ghi chú không quá 1000 ký tự.") String note) {
    }
}
