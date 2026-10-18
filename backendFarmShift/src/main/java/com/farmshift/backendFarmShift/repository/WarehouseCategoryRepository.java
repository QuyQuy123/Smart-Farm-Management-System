package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.WarehouseCategory;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WarehouseCategoryRepository extends JpaRepository<WarehouseCategory, Long> {
    boolean existsByNameKey(String nameKey);
    boolean existsByNameKeyAndIdNot(String nameKey, Long id);
}
