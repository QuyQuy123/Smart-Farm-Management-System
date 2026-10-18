package com.farmshift.backendFarmShift.dto.request;

import jakarta.validation.constraints.*;

public record SupplierRequest(
    @NotBlank(message = "Vui lòng nhập đơn vị cung cấp.") @Size(max = 200) String name,
    @NotBlank(message = "Vui lòng nhập người đại diện.") @Size(max = 100) String representative,
    @NotBlank(message = "Vui lòng nhập số điện thoại.") @Size(max = 20)
    @Pattern(regexp = "(?=(?:\\D*\\d){9,15}\\D*$)[0-9+() .-]{9,20}", message = "Số điện thoại phải có từ 9 đến 15 chữ số.") String phone,
    @NotNull(message = "Vui lòng chọn nhóm nhà cung cấp.") @Positive Long productTypeId) {
}
