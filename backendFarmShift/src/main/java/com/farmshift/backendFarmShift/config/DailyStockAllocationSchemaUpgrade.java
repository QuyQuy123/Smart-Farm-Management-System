package com.farmshift.backendFarmShift.config;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.ApplicationArguments;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@RequiredArgsConstructor
public class DailyStockAllocationSchemaUpgrade implements ApplicationRunner {
    private final JdbcTemplate jdbc;

    public void run(ApplicationArguments args) {
        ensureNumericScale6("inventory_items", "stock");
        ensureNumericScale6("daily_task_logs", "stock_quantity");
        jdbc.execute("""
                CREATE TABLE IF NOT EXISTS daily_stock_allocations (
                    log_id bigint NOT NULL REFERENCES daily_task_logs(id) ON DELETE CASCADE,
                    inventory_item_id bigint NOT NULL REFERENCES inventory_items(id),
                    quantity numeric(19,6) NOT NULL
                )
                """);
    }

    private void ensureNumericScale6(String table, String column) {
        Integer scale = jdbc.query(
                "SELECT numeric_scale FROM information_schema.columns "
                        + "WHERE LOWER(table_schema) = COALESCE(LOWER(CURRENT_SCHEMA()), 'public') "
                        + "AND LOWER(table_name) = ? AND LOWER(column_name) = ? LIMIT 1",
                rs -> rs.next() ? (Integer) rs.getObject(1) : null,
                table, column
        );
        if (scale == null || scale < 6) {
            jdbc.execute("ALTER TABLE " + table + " ALTER COLUMN " + column + " TYPE numeric(19,6)");
        }
    }
}
