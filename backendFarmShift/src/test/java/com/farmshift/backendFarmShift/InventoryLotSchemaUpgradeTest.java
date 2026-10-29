package com.farmshift.backendFarmShift;

import com.farmshift.backendFarmShift.config.InventoryLotSchemaUpgrade;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import static org.junit.jupiter.api.Assertions.assertEquals;

class InventoryLotSchemaUpgradeTest {
    @Test
    void removesLegacyUniquenessWithoutLosingRowsAndCanRunTwice() {
        var dataSource = new DriverManagerDataSource("jdbc:h2:mem:lot_migration;MODE=PostgreSQL;DB_CLOSE_DELAY=-1", "sa", "");
        var jdbc = new JdbcTemplate(dataSource);
        jdbc.execute("CREATE TABLE inventory_items (id bigint primary key, warehouse_id bigint, product_id bigint, stock integer, CONSTRAINT uq_inventory_warehouse_product UNIQUE(warehouse_id, product_id))");
        jdbc.execute("INSERT INTO inventory_items VALUES (1, 10, 20, 100)");
        var upgrade = new InventoryLotSchemaUpgrade(jdbc);
        upgrade.run(null);
        upgrade.run(null);
        jdbc.execute("INSERT INTO inventory_items VALUES (2, 10, 20, 200)");
        assertEquals(2, jdbc.queryForObject("SELECT count(*) FROM inventory_items", Integer.class));
        assertEquals(300, jdbc.queryForObject("SELECT sum(stock) FROM inventory_items", Integer.class));
    }
}
