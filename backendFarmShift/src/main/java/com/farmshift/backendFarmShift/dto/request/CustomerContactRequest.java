package com.farmshift.backendFarmShift.dto.request;

import jakarta.validation.constraints.*;

public record CustomerContactRequest(
    @NotBlank(message = "Vui lòng nhập tên khách hàng.") @Size(max = 200) String name,
    @NotBlank(message = "Vui lòng nhập số điện thoại.") @Size(max = 20)
    @Pattern(regexp = com.farmshift.backendFarmShift.validation.ContactPhoneRules.PATTERN, message = com.farmshift.backendFarmShift.validation.ContactPhoneRules.MESSAGE) String phone) {
}
