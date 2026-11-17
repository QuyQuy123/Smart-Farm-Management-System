package com.farmshift.backendFarmShift.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record PushSubscribeRequest(
        @NotBlank(message = "Thiếu endpoint thông báo đẩy.")
        @Size(max = 2000, message = "Endpoint quá dài.")
        String endpoint,

        @NotNull(message = "Thiếu khóa mã hóa Web Push.")
        @Valid
        Keys keys,

        @Size(max = 500, message = "Thông tin thiết bị không vượt quá 500 ký tự.")
        String userAgent
) {
    public record Keys(
            @NotBlank(message = "Thiếu khóa công khai p256dh.")
            @Size(max = 255)
            String p256dh,

            @NotBlank(message = "Thiếu khóa xác thực auth.")
            @Size(max = 255)
            String auth
    ) {}
}
