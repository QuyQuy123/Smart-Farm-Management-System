package com.farmshift.backendFarmShift.dto.response;

import java.time.OffsetDateTime;
import java.time.ZoneId;

public record PushPayloadDto(
        String title,
        String body,
        String icon,
        String badge,
        String tag,
        String url,
        String severity,
        String timestamp
) {
    private static final ZoneId VN_ZONE = ZoneId.of("Asia/Bangkok");
    public static final String DEFAULT_ICON = "/favicon.png";

    public static PushPayloadDto of(String title, String body, String tag, String url, String severity) {
        return new PushPayloadDto(
                title,
                body,
                DEFAULT_ICON,
                DEFAULT_ICON,
                tag != null && !tag.isBlank() ? tag : "farmshift-alert",
                url != null && !url.isBlank() ? url : "/iot",
                severity != null && !severity.isBlank() ? severity : "INFO",
                OffsetDateTime.now(VN_ZONE).toString()
        );
    }
}
