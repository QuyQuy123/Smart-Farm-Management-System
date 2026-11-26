package com.farmshift.backendFarmShift.dto.request;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public record IotTelemetryPushRequest(
        @NotNull(message = "Thiếu mã chuồng.")
        @Positive
        Long barnId,

        Boolean connected,

        @DecimalMin("-20.0") @DecimalMax("80.0")
        BigDecimal temp1,

        @DecimalMin("0.0") @DecimalMax("100.0")
        BigDecimal humi1,

        @DecimalMin("-20.0") @DecimalMax("80.0")
        BigDecimal temp3,

        @DecimalMin("0.0") @DecimalMax("100.0")
        BigDecimal humi3,

        Map<Integer, Boolean> relayStates,

        @Size(max = 20)
        List<@Size(max = 80) String> activeDeviceLabels,

        @Size(max = 40)
        String source
) {
}
