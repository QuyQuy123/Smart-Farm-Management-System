package com.farmshift.backendFarmShift.config;

import com.farmshift.backendFarmShift.service.AreaWarehouseService;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** Thêm cột khu / loại kho (ddl-auto=none) rồi bổ sung kho cám, kho thuốc cho mọi khu chưa có. */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 1)
@RequiredArgsConstructor
public class AreaWarehouseSchemaUpgrade implements ApplicationRunner {
    private final JdbcTemplate jdbc;
    private final AreaWarehouseService areaWarehouses;

    @Override
    public void run(ApplicationArguments args) {
        jdbc.execute("ALTER TABLE warehouse_categories ADD COLUMN IF NOT EXISTS area_id bigint REFERENCES farm_areas(id)");
        jdbc.execute("ALTER TABLE warehouse_categories ADD COLUMN IF NOT EXISTS kind varchar(20)");
        areaWarehouses.ensureAll();
    }
}
