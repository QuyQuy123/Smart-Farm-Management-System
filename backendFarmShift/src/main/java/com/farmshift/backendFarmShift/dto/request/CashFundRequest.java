package com.farmshift.backendFarmShift.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CashFundRequest(
        @NotBlank(message = "Vui lòng nhập tên nguồn quỹ.") @Size(max = 150) String name,
        @Size(max = 80) String accountNo,
        @NotBlank(message = "Vui lòng nhập ngân hàng / đơn vị quản lý.") @Size(max = 150) String bank,
        @Size(max = 30) String fundType,
        @NotNull(message = "Vui lòng nhập số dư quỹ.") @Min(value = 0, message = "Số dư quỹ không được âm.") Long balance,
        @Size(max = 500) String note
) {
}

