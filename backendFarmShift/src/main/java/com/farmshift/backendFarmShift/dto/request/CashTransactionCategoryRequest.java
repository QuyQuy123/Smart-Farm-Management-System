package com.farmshift.backendFarmShift.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CashTransactionCategoryRequest(
        @NotBlank(message = "Vui lòng nhập tên loại phiếu.") @Size(max = 150) String name,
        @NotBlank(message = "Vui lòng chọn phân loại (Thu / Chi).") String type,
        @NotBlank(message = "Vui lòng nhập nhóm chi phí.") @Size(max = 120) String costGroup,
        @Size(max = 500) String note
) {
}

