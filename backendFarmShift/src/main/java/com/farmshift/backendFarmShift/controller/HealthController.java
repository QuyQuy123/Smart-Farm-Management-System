package com.farmshift.backendFarmShift.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

/**
 * Public health check controller for uptime monitoring (e.g. UptimeRobot, Render Health Check).
 * Accessible without authentication.
 */
@RestController
public class HealthController {

    @GetMapping({"/api/health", "/health"})
    public ResponseEntity<Map<String, Object>> healthCheck() {
        return ResponseEntity.ok(Map.of(
                "status", "UP",
                "service", "FarmShift Backend",
                "timestamp", Instant.now().toString()
        ));
    }
}
