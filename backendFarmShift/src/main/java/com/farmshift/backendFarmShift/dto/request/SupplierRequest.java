package com.farmshift.backendFarmShift.dto.request;

import jakarta.validation.constraints.*;

public record SupplierRequest(
    @NotBlank(message = "Vui lòng nhập đơn vị cung cấp.") @Size(max = 200) String name,
    @NotBlank(message = "Vui lòng nhập người đại diện.") @Size(max = 100) String representative,
    @NotBlank(message = "Vui lòng nhập số điện thoại.") @Size(max = 20)
    @Pattern(regexp = com.farmshift.backendFarmShift.validation.ContactPhoneRules.PATTERN, message = com.farmshift.backendFarmShift.validation.ContactPhoneRules.MESSAGE) String phone,
    @NotNull(message = "Vui lòng chọn nhóm nhà cung cấp.") @Positive Long productTypeId) {
}
