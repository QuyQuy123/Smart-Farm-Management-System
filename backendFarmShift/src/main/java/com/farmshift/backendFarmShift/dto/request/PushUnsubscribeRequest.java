package com.farmshift.backendFarmShift.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PushUnsubscribeRequest(
        @NotBlank(message = "Thiếu endpoint cần hủy đăng ký.")
        @Size(max = 2000, message = "Endpoint quá dài.")
        String endpoint
) {
}
