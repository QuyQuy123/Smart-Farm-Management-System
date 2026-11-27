package com.farmshift.backendFarmShift.config;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class IotEventSchemaUpgrade implements ApplicationRunner {
    private final JdbcTemplate jdbc;
    public void run(ApplicationArguments args) {
        jdbc.execute("""
            CREATE TABLE IF NOT EXISTS iot_activation_events (
                id UUID PRIMARY KEY,
                barn_id BIGINT NOT NULL,
                device_name VARCHAR(100) NOT NULL,
                device_type VARCHAR(10) NOT NULL,
                relay INTEGER NOT NULL,
                mode VARCHAR(10) NOT NULL,
                temperature1 DOUBLE PRECISION,
                temperature3 DOUBLE PRECISION,
                occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
                recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                actor VARCHAR(255) NOT NULL
            )
            """);
        jdbc.execute("CREATE INDEX IF NOT EXISTS idx_iot_events_barn_time ON iot_activation_events(barn_id, occurred_at DESC, id)");
    }
}
