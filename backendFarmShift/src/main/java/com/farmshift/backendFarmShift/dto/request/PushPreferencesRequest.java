package com.farmshift.backendFarmShift.dto.request;

import jakarta.validation.constraints.NotNull;

public record PushPreferencesRequest(
        @NotNull(message = "Thiếu trạng thái thông báo trong ứng dụng") Boolean inAppEnabled,
        @NotNull(message = "Thiếu trạng thái cảnh báo IoT") Boolean iotAlertEnabled,
        @NotNull(message = "Thiếu trạng thái nhắc lịch tiêm phòng và công việc") Boolean taskVaccineReminderEnabled,
        Boolean debtReminderEnabled
) {}
