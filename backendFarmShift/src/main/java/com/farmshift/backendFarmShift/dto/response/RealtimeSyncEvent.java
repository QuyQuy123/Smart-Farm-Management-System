package com.farmshift.backendFarmShift.dto.response;

/**
 * Lightweight STOMP payload broadcast to connected clients whenever a farm mutation commits.
 */
public record RealtimeSyncEvent(
        String type,
        String resource,
        String method,
        String actor,
        String originClientId,
        String timestamp
) {
}
