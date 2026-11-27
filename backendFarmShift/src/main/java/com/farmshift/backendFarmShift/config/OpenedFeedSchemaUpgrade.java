package com.farmshift.backendFarmShift.config;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Idempotent schema upgrade for tracking opened-bag feed balances per cycle
 * and whole-bag warehouse deduction metadata on daily task logs.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@RequiredArgsConstructor
public class OpenedFeedSchemaUpgrade implements ApplicationRunner {
    private final JdbcTemplate jdbc;

    @Override
    public void run(ApplicationArguments args) {
        jdbc.execute("""
                CREATE TABLE IF NOT EXISTS cycle_opened_feeds (
                    id BIGSERIAL PRIMARY KEY,
                    cycle_id BIGINT NOT NULL REFERENCES farming_cycles(id),
                    product_id BIGINT NOT NULL REFERENCES product_categories(id),
                    warehouse_id BIGINT REFERENCES warehouse_categories(id),
                    unit_id BIGINT REFERENCES measurement_units(id),
                    kg_per_bag NUMERIC(12,3) NOT NULL,
                    remaining_kg NUMERIC(14,3) NOT NULL DEFAULT 0,
                    remaining_value NUMERIC(16,2) NOT NULL DEFAULT 0,
                    updated_at TIMESTAMP
                )
                """);
        jdbc.execute("CREATE UNIQUE INDEX IF NOT EXISTS uk_cycle_opened_feeds_cycle_product ON cycle_opened_feeds(cycle_id, product_id)");
        jdbc.execute("CREATE INDEX IF NOT EXISTS idx_cycle_opened_feeds_cycle ON cycle_opened_feeds(cycle_id)");

        jdbc.execute("ALTER TABLE daily_task_logs ADD COLUMN IF NOT EXISTS opened_bags_kg NUMERIC(14,3)");
        jdbc.execute("ALTER TABLE daily_task_logs ADD COLUMN IF NOT EXISTS opened_bags_cost NUMERIC(16,2)");
    }
}
