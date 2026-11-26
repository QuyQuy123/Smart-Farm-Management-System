package com.farmshift.backendFarmShift.config;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Idempotent schema upgrade for default daily barn routine checklist tasks
 * ("Thay trấu", "Vệ sinh máng", "Xịt rửa chuồng").
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@RequiredArgsConstructor
public class BarnRoutineTaskSchemaUpgrade implements ApplicationRunner {
    private final JdbcTemplate jdbc;

    @Override
    public void run(ApplicationArguments args) {
        jdbc.execute("ALTER TABLE barns ADD COLUMN IF NOT EXISTS routine_tasks VARCHAR(500)");
        jdbc.execute("""
                CREATE TABLE IF NOT EXISTS barn_routine_task_checks (
                    id BIGSERIAL PRIMARY KEY,
                    cycle_id BIGINT NOT NULL REFERENCES farming_cycles(id),
                    barn_id BIGINT NOT NULL REFERENCES barns(id),
                    task_code VARCHAR(60) NOT NULL,
                    task_title VARCHAR(150) NOT NULL,
                    check_date DATE NOT NULL,
                    done_by VARCHAR(150) NOT NULL,
                    done_at TIMESTAMP NOT NULL,
                    note VARCHAR(500)
                )
                """);
        jdbc.execute("CREATE UNIQUE INDEX IF NOT EXISTS uk_barn_routine_checks_cycle_date_code ON barn_routine_task_checks(cycle_id, check_date, task_code)");
        jdbc.execute("CREATE INDEX IF NOT EXISTS idx_barn_routine_checks_date ON barn_routine_task_checks(check_date)");
    }
}
