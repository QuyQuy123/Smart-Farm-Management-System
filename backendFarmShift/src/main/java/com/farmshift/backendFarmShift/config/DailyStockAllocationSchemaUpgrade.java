package com.farmshift.backendFarmShift.config;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.ApplicationArguments;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class DailyStockAllocationSchemaUpgrade implements ApplicationRunner {
    private final JdbcTemplate jdbc;
    public void run(ApplicationArguments args) {
        jdbc.execute("ALTER TABLE inventory_items ALTER COLUMN stock TYPE numeric(19,6)");
        jdbc.execute("ALTER TABLE daily_task_logs ALTER COLUMN stock_quantity TYPE numeric(19,6)");
        jdbc.execute("""
                CREATE TABLE IF NOT EXISTS daily_stock_allocations (
                    log_id bigint NOT NULL REFERENCES daily_task_logs(id) ON DELETE CASCADE,
                    inventory_item_id bigint NOT NULL REFERENCES inventory_items(id),
                    quantity numeric(19,6) NOT NULL
                )
                """);
    }
}
