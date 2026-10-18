package com.farmshift.backendFarmShift.dto.request;

import jakarta.validation.constraints.*;
import java.util.List;

public record FarmAreaRequest(
        @NotBlank(message = "Vui lòng nhập tên khu nuôi.")
        @Size(max = 150, message = "Tên khu nuôi không quá 150 ký tự.") String name,
        List<String> environmentMetrics,
        List<String> animalMetrics,
        @Size(max = 1000, message = "Ghi chú không quá 1000 ký tự.") String description) {
}
