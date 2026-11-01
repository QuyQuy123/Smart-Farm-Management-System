package com.farmshift.backendFarmShift.config;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Thêm các cột của nhật ký chuồng và nhập đàn cho DB cũ vì ddl-auto=none không tự thêm:
 * giờ cữ ăn đầu tiên, ảnh đính kèm hao hụt, nhà cung cấp của đàn, hóa đơn nhập gắn với đàn.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@RequiredArgsConstructor
public class FarmJournalSchemaUpgrade implements ApplicationRunner {
    private final JdbcTemplate jdbc;

    @Override
    public void run(ApplicationArguments args) {
        jdbc.execute("ALTER TABLE farms ADD COLUMN IF NOT EXISTS first_meal_time time");
        jdbc.execute("ALTER TABLE flock_movements ADD COLUMN IF NOT EXISTS photo_urls varchar(2000)");
        jdbc.execute("ALTER TABLE flocks ADD COLUMN IF NOT EXISTS supplier_id bigint REFERENCES suppliers(id)");
        jdbc.execute("ALTER TABLE purchase_invoices ADD COLUMN IF NOT EXISTS flock_id bigint REFERENCES flocks(id)");
    }
}
