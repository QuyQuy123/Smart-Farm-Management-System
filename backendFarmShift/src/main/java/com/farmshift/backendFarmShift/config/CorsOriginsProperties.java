package com.farmshift.backendFarmShift.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Resolves allowed CORS and WebSocket handshake origins across local dev, Docker Nginx, and cloud deploys.
 */
@Component
public class CorsOriginsProperties {

    private static final List<String> DEFAULT_EXACT_ORIGINS = List.of(
            "http://localhost:5173",
            "http://localhost:5174",
            "http://localhost:5175",
            "http://localhost:3000",
            "https://farmshift-smartfarm.vercel.app",
            "https://admin-ae1mzp943-acet-ech291.vercel.app",
            "https://admin-flax-eta-71.vercel.app",
            "https://admin-acet-ech291.vercel.app"
    );

    private final List<String> allowedOriginPatterns;
    private final List<String> allowedOrigins;

    public CorsOriginsProperties(
            @Value("${app.cors.allowed-origin-patterns:http://localhost:*,http://127.0.0.1:*}") String rawPatterns,
            @Value("${app.cors.allowed-origins:}") String rawOrigins,
            @Value("${app.cors.camera-web-origin:}") String cameraWebOrigin
    ) {
        this.allowedOriginPatterns = splitCsv(rawPatterns);

        Set<String> origins = new LinkedHashSet<>(DEFAULT_EXACT_ORIGINS);
        origins.addAll(splitCsv(rawOrigins));
        if (cameraWebOrigin != null && !cameraWebOrigin.isBlank()) {
            origins.add(cameraWebOrigin.trim());
        }
        this.allowedOrigins = List.copyOf(origins);
    }

    public List<String> getAllowedOriginPatterns() {
        return allowedOriginPatterns;
    }

    public List<String> getAllowedOrigins() {
        return allowedOrigins;
    }

    /** Combines origin patterns and explicit origins for Spring WebSocket STOMP handshake matching. */
    public String[] combinedOriginPatternsArray() {
        Set<String> merged = new LinkedHashSet<>(allowedOriginPatterns);
        merged.addAll(allowedOrigins);
        return merged.toArray(String[]::new);
    }

    private static List<String> splitCsv(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        List<String> list = new ArrayList<>();
        Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .forEach(list::add);
        return List.copyOf(list);
    }
}
