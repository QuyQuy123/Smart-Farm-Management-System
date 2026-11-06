package com.farmshift.backendFarmShift.config;

import com.farmshift.backendFarmShift.service.AreaWarehouseService;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** Thêm cột khu / loại kho và bảng liên kết farm_area_warehouses (ddl-auto=none) rồi bổ sung kho cám, kho thuốc cho mọi khu chưa có. */
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
        jdbc.execute("CREATE TABLE IF NOT EXISTS farm_area_warehouses (" +
                "area_id bigint NOT NULL REFERENCES farm_areas(id) ON DELETE CASCADE, " +
                "warehouse_id bigint NOT NULL REFERENCES warehouse_categories(id) ON DELETE CASCADE, " +
                "PRIMARY KEY (area_id, warehouse_id))");
        jdbc.execute("INSERT INTO farm_area_warehouses (area_id, warehouse_id) " +
                "SELECT area_id, id FROM warehouse_categories " +
                "WHERE area_id IS NOT NULL " +
                "ON CONFLICT DO NOTHING");
        areaWarehouses.ensureAll();
    }
}
