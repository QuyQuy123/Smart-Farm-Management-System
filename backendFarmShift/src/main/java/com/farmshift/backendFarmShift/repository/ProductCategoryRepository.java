package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.ProductCategory;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductCategoryRepository extends JpaRepository<ProductCategory, Long> {
    boolean existsByWarehouse_Id(Long warehouseId);
    boolean existsByNameKey(String nameKey);
    boolean existsByNameKeyAndIdNot(String nameKey, Long id);
}
