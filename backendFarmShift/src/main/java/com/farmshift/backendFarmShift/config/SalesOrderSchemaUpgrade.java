package com.farmshift.backendFarmShift.config;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Thêm các cột bán hàng (phiếu cân, lứa nuôi, biến động đàn) cho DB cũ vì ddl-auto=none không tự thêm.
 * Chạy trước các runner khác (SalesInvoiceCodeMigration đọc bảng sales_orders).
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@RequiredArgsConstructor
public class SalesOrderSchemaUpgrade implements ApplicationRunner {
    private final JdbcTemplate jdbc;

    @Override
    public void run(ApplicationArguments args) {
        jdbc.execute("ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS weight_slip_url varchar(500)");
        jdbc.execute("ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS cycle_id bigint REFERENCES farming_cycles(id)");
        jdbc.execute("ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS movement_id bigint UNIQUE REFERENCES flock_movements(id)");
    }
}
