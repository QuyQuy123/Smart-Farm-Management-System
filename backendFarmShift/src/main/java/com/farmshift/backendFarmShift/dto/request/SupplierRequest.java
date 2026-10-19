package com.farmshift.backendFarmShift.dto.request;

import jakarta.validation.constraints.*;
import java.util.List;

public record SupplierRequest(
    @NotBlank(message = "Vui lòng nhập đơn vị cung cấp.") @Size(max = 200) String name,
    @NotBlank(message = "Vui lòng nhập người đại diện.") @Size(max = 100) String representative,
    @NotBlank(message = "Vui lòng nhập số điện thoại.") @Size(max = 20)
    @Pattern(regexp = com.farmshift.backendFarmShift.validation.ContactPhoneRules.PATTERN, message = com.farmshift.backendFarmShift.validation.ContactPhoneRules.MESSAGE) String phone,
    @NotNull(message = "Vui lòng chọn nhóm nhà cung cấp.") @Positive Long productTypeId,
    String email,
    String address,
    String taxCode,
    String bankName,
    String bankAccount,
    String paymentPolicy,
    Long openingDebt,
    String note,
    List<Long> tagIds
) {
    public SupplierRequest(String name, String representative, String phone, Long productTypeId) {
        this(name, representative, phone, productTypeId, null, null, null, null, null, null, 0L, null, List.of());
    }
}
