package com.farmshift.backendFarmShift.config;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Retain existing inventory and references while permitting multiple receipt lots per product. */
@Component
@RequiredArgsConstructor
public class InventoryLotSchemaUpgrade implements ApplicationRunner {
    private final JdbcTemplate jdbc;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        jdbc.execute("ALTER TABLE inventory_items DROP CONSTRAINT IF EXISTS uq_inventory_warehouse_product");
    }
}
