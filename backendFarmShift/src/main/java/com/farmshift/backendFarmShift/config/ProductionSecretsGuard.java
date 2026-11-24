package com.farmshift.backendFarmShift.config;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * Fails fast in production profiles when critical shared tokens use insecure local defaults.
 */
@Component
@Profile({"prod", "production"})
public class ProductionSecretsGuard {

    private static final Set<String> INSECURE_DEFAULTS = Set.of(
            "farmshift-local-ai-token",
            "farmshift-default-ai-hmac-secret-key-2026",
            "farmshift-default-ai-hmac-secret-key-2026-change-in-production"
    );

    @Value("${jwt.secret:}")
    private String jwtSecret;

    @Value("${ai-service.internal-token:}")
    private String aiInternalToken;

    @PostConstruct
    void verifyProductionSecrets() {
        if (jwtSecret == null || jwtSecret.isBlank() || INSECURE_DEFAULTS.contains(jwtSecret.trim())) {
            throw new IllegalStateException("Production profile requires a non-default JWT_SECRET.");
        }
        if (aiInternalToken == null || aiInternalToken.isBlank() || INSECURE_DEFAULTS.contains(aiInternalToken.trim())) {
            throw new IllegalStateException("Production profile requires a non-default AI_INTERNAL_TOKEN.");
        }
    }
}
