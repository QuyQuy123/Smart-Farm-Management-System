package com.farmshift.backendFarmShift.config;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Idempotent schema upgrade for OPS-01 (Farming Program upgrade):
 * - Widens category/method columns to VARCHAR(32) for DRINKING_MEDICINE, CARE_PROCEDURE, HAND_DRINKER, AUTO_DRINKER.
 * - Adds feed_input_mode, bag_weight_kg, bags_per_1000_birds on farming_program_steps.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@RequiredArgsConstructor
public class FarmingProgramUpgradeSchemaRunner implements ApplicationRunner {
    private final JdbcTemplate jdbc;

    @Override
    public void run(ApplicationArguments args) {
        ensureVarcharLength("farming_program_steps", "category", 32);
        ensureVarcharLength("farming_program_steps", "method", 32);
        ensureVarcharLength("daily_task_logs", "category", 32);

        jdbc.execute("ALTER TABLE farming_program_steps ADD COLUMN IF NOT EXISTS feed_input_mode VARCHAR(30)");
        jdbc.execute("ALTER TABLE farming_program_steps ADD COLUMN IF NOT EXISTS bag_weight_kg NUMERIC(10,3)");
        jdbc.execute("ALTER TABLE farming_program_steps ADD COLUMN IF NOT EXISTS bags_per_1000_birds NUMERIC(14,3)");
    }

    private void ensureVarcharLength(String table, String column, int minLength) {
        Integer maxLen = jdbc.query(
                "SELECT character_maximum_length FROM information_schema.columns WHERE LOWER(table_name) = ? AND LOWER(column_name) = ? LIMIT 1",
                rs -> rs.next() && rs.getObject(1) != null ? ((Number) rs.getObject(1)).intValue() : null,
                table, column
        );
        if (maxLen != null && maxLen < minLength) {
            jdbc.execute("ALTER TABLE " + table + " ALTER COLUMN " + column + " TYPE VARCHAR(" + minLength + ")");
        }
    }
}
