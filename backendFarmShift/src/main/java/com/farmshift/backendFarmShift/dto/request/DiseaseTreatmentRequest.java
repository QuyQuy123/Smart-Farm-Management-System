package com.farmshift.backendFarmShift.dto.request;

import com.farmshift.backendFarmShift.entity.AdministrationMethod;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;

public record DiseaseTreatmentRequest(
        @NotNull(message = "Vui lòng chọn ngày dùng thuốc.") LocalDate treatmentDate,
        @Size(max = 200, message = "Tên thuốc không quá 200 ký tự.") String medicineName,
        AdministrationMethod method,
        @Size(max = 200, message = "Liều lượng/cách dùng không quá 200 ký tự.") String dosageText,
        @Positive(message = "Hàng hóa kho không hợp lệ.") Long inventoryItemId,
        @DecimalMin(value = "0.000001", message = "Số lượng xuất kho phải lớn hơn 0.") BigDecimal stockQuantity,
        @DecimalMin(value = "0", message = "Chi phí thuốc không được âm.") BigDecimal manualCost,
        @Size(max = 1000, message = "Ghi chú không quá 1000 ký tự.") String note
) { }
