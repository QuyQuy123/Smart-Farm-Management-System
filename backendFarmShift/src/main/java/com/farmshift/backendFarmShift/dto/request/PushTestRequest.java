package com.farmshift.backendFarmShift.dto.request;

import jakarta.validation.constraints.Size;

public record PushTestRequest(
        @Size(max = 160) String title,
        @Size(max = 500) String body,
        @Size(max = 200) String url,
        @Size(max = 100) String tag,
        @Size(max = 30) String severity
) {
}
