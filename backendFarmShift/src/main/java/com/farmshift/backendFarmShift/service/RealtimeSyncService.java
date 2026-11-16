package com.farmshift.backendFarmShift.service;

import com.farmshift.backendFarmShift.dto.response.RealtimeSyncEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.time.ZoneId;

/**
 * Broadcasts domain mutation notifications over STOMP WebSocket topic {@code /topic/farm-updates}.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RealtimeSyncService {

    public static final String FARM_UPDATES_TOPIC = "/topic/farm-updates";
    private static final ZoneId VN_ZONE = ZoneId.of("Asia/Bangkok");

    private final SimpMessagingTemplate messagingTemplate;

    public void broadcastDataChange(String rawResource, String method, String actor, String originClientId) {
        String resource = normalizeResource(rawResource);
        RealtimeSyncEvent event = new RealtimeSyncEvent(
                "DATA_CHANGED",
                resource,
                method != null ? method.toUpperCase() : "POST",
                actor,
                sanitizeClientId(originClientId),
                OffsetDateTime.now(VN_ZONE).toString()
        );
        try {
            messagingTemplate.convertAndSend(FARM_UPDATES_TOPIC, event);
        } catch (Exception ex) {
            log.debug("Failed to broadcast STOMP realtime event for {}: {}", resource, ex.getMessage());
        }
    }

    /**
     * Normalizes an API request URI into a stable resource prefix matching frontend INVALIDATION_MATRIX keys.
     */
    public static String normalizeResource(String rawResource) {
        if (rawResource == null || rawResource.isBlank()) {
            return "/all";
        }
        String path = rawResource.trim().split("\\?")[0];
        if ("/*".equals(path) || "*".equals(path) || "/all".equals(path)) {
            return "/all";
        }
        if (path.startsWith("/api/")) {
            path = path.substring(4);
        } else if ("/api".equals(path)) {
            return "/all";
        }
        if (!path.startsWith("/")) {
            path = "/" + path;
        }
        String[] segments = path.substring(1).split("/");
        if (segments.length == 0 || segments[0].isEmpty()) {
            return "/all";
        }
        return "/" + segments[0];
    }

    private static String sanitizeClientId(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String trimmed = raw.trim();
        if (trimmed.length() > 64) {
            trimmed = trimmed.substring(0, 64);
        }
        return trimmed.matches("[A-Za-z0-9_-]+") ? trimmed : null;
    }
}
