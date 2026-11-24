package com.farmshift.backendFarmShift.config;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Additive, idempotent schema upgrade creating {@code ai_interaction_logs}
 * for the AI Data Flywheel when {@code spring.jpa.hibernate.ddl-auto=none}.
 */
@Component
@RequiredArgsConstructor
public class AiInteractionLogSchemaUpgrade implements ApplicationRunner {

    private final JdbcTemplate jdbc;

    @Override
    public void run(ApplicationArguments args) {
        jdbc.execute("""
                CREATE TABLE IF NOT EXISTS ai_interaction_logs (
                    id BIGSERIAL PRIMARY KEY,
                    request_id VARCHAR(64) NOT NULL,
                    session_id VARCHAR(128),
                    account_id BIGINT REFERENCES accounts(id) ON DELETE SET NULL,
                    username VARCHAR(100) NOT NULL,
                    user_role VARCHAR(30) NOT NULL,
                    current_route VARCHAR(255),
                    raw_message TEXT NOT NULL,
                    normalized_message TEXT,
                    intent VARCHAR(80),
                    handler_tier VARCHAR(50),
                    provider VARCHAR(80),
                    confidence DOUBLE PRECISION,
                    executed BOOLEAN NOT NULL DEFAULT FALSE,
                    requires_confirmation BOOLEAN NOT NULL DEFAULT FALSE,
                    confirmed BOOLEAN,
                    latency_ms BIGINT NOT NULL DEFAULT 0,
                    reply_preview VARCHAR(1000),
                    extracted_payload TEXT,
                    feedback_rating SMALLINT,
                    feedback_note VARCHAR(500),
                    feedback_corrected_intent VARCHAR(80),
                    feedback_at TIMESTAMP,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """);
        jdbc.execute("CREATE INDEX IF NOT EXISTS idx_ai_logs_created_at ON ai_interaction_logs(created_at DESC)");
        jdbc.execute("CREATE INDEX IF NOT EXISTS idx_ai_logs_intent_rating ON ai_interaction_logs(intent, feedback_rating)");
        jdbc.execute("CREATE INDEX IF NOT EXISTS idx_ai_logs_username ON ai_interaction_logs(username, created_at DESC)");
        jdbc.execute("CREATE INDEX IF NOT EXISTS idx_ai_logs_request_id ON ai_interaction_logs(request_id)");
    }
}
