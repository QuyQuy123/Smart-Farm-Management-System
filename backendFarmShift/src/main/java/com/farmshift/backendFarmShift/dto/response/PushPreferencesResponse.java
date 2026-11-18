package com.farmshift.backendFarmShift.dto.response;

public record PushPreferencesResponse(
        boolean inAppEnabled,
        boolean iotAlertEnabled,
        boolean taskVaccineReminderEnabled,
        boolean debtReminderEnabled
) {}
