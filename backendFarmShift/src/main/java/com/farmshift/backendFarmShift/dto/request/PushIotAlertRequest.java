package com.farmshift.backendFarmShift.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record PushIotAlertRequest(
        @NotNull(message = "Thiếu mã chuồng.")
        @Positive
        Long barnId,

        @NotBlank(message = "Thiếu tiêu đề cảnh báo.")
        @Size(max = 160)
        String title,

        @NotBlank(message = "Thiếu nội dung cảnh báo.")
        @Size(max = 500)
        String body,

        @Size(max = 30)
        String severity
) {
}
