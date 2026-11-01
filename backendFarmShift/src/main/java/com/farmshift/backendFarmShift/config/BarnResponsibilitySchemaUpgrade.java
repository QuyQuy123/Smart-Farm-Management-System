package com.farmshift.backendFarmShift.config;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** Additive, repeatable upgrade for installations with Hibernate DDL disabled. */
@Component
@RequiredArgsConstructor
public class BarnResponsibilitySchemaUpgrade implements ApplicationRunner {
    private final JdbcTemplate jdbc;

    @Override
    public void run(ApplicationArguments args) {
        jdbc.execute("ALTER TABLE barns ADD COLUMN IF NOT EXISTS workers_override boolean");
        jdbc.execute("""
                CREATE TABLE IF NOT EXISTS farm_area_workers (
                    area_id bigint NOT NULL REFERENCES farm_areas(id) ON DELETE CASCADE,
                    account_id bigint NOT NULL REFERENCES accounts(id),
                    CONSTRAINT uk_farm_area_workers UNIQUE (area_id, account_id)
                )
                """);
    }
}
