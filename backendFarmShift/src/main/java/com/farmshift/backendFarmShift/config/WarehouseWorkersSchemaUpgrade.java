package com.farmshift.backendFarmShift.config;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class WarehouseWorkersSchemaUpgrade implements ApplicationRunner {
    private final JdbcTemplate jdbc;

    @Override
    public void run(ApplicationArguments args) {
        jdbc.execute("""
                CREATE TABLE IF NOT EXISTS warehouse_workers (
                    warehouse_id bigint NOT NULL REFERENCES warehouse_categories(id) ON DELETE CASCADE,
                    account_id bigint NOT NULL REFERENCES accounts(id),
                    CONSTRAINT uk_warehouse_workers UNIQUE (warehouse_id, account_id)
                )
                """);
    }
}
