package com.farmshift.backendFarmShift.config;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Idempotent schema upgrade for OPS-02 (Cycle Disease Log & Multi-day Treatments).
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@RequiredArgsConstructor
public class DiseaseRecordSchemaUpgrade implements ApplicationRunner {
    private final JdbcTemplate jdbc;

    @Override
    public void run(ApplicationArguments args) {
        jdbc.execute("""
                CREATE TABLE IF NOT EXISTS cycle_diseases (
                    id BIGSERIAL PRIMARY KEY,
                    cycle_id BIGINT NOT NULL REFERENCES farming_cycles(id),
                    flock_id BIGINT REFERENCES flocks(id),
                    disease_name VARCHAR(200) NOT NULL,
                    symptoms VARCHAR(1000),
                    start_date DATE NOT NULL,
                    end_date DATE,
                    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
                    affected_quantity INTEGER,
                    note VARCHAR(1000),
                    created_by VARCHAR(150),
                    created_at TIMESTAMP,
                    updated_at TIMESTAMP
                )
                """);
        jdbc.execute("CREATE INDEX IF NOT EXISTS idx_cycle_diseases_cycle_status ON cycle_diseases(cycle_id, status)");

        jdbc.execute("""
                CREATE TABLE IF NOT EXISTS disease_treatment_logs (
                    id BIGSERIAL PRIMARY KEY,
                    disease_id BIGINT NOT NULL REFERENCES cycle_diseases(id),
                    treatment_date DATE NOT NULL,
                    medicine_name VARCHAR(200) NOT NULL,
                    method VARCHAR(32),
                    dosage_text VARCHAR(200),
                    inventory_item_id BIGINT REFERENCES inventory_items(id),
                    stock_quantity NUMERIC(19,6),
                    unit_price NUMERIC(19,2),
                    cost NUMERIC(19,2) NOT NULL DEFAULT 0,
                    expense_id BIGINT REFERENCES cycle_expenses(id),
                    note VARCHAR(1000),
                    created_by VARCHAR(150),
                    created_at TIMESTAMP
                )
                """);
        jdbc.execute("CREATE INDEX IF NOT EXISTS idx_disease_treatments_disease_date ON disease_treatment_logs(disease_id, treatment_date)");

        jdbc.execute("""
                CREATE TABLE IF NOT EXISTS disease_treatment_stock_allocations (
                    treatment_log_id BIGINT NOT NULL REFERENCES disease_treatment_logs(id) ON DELETE CASCADE,
                    inventory_item_id BIGINT NOT NULL REFERENCES inventory_items(id),
                    quantity NUMERIC(19,6) NOT NULL
                )
                """);
    }
}
