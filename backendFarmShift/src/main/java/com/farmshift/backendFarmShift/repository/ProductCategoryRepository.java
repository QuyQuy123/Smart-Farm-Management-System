package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.ProductCategory;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductCategoryRepository extends JpaRepository<ProductCategory, Long> {
    @org.springframework.data.jpa.repository.Query("select count(p) from ProductCategory p where lower(trim(p.specification)) = lower(:unitName)")
    long countByUnitName(@org.springframework.data.repository.query.Param("unitName") String unitName);

    @org.springframework.data.jpa.repository.Modifying(flushAutomatically = true, clearAutomatically = true)
    @org.springframework.data.jpa.repository.Query("update ProductCategory p set p.specification = :newName where lower(trim(p.specification)) = lower(:oldName)")
    int renameUnitSpecifications(@org.springframework.data.repository.query.Param("oldName") String oldName,
                                @org.springframework.data.repository.query.Param("newName") String newName);
    boolean existsByWarehouse_Id(Long warehouseId);
    boolean existsByNameKey(String nameKey);
    boolean existsByNameKeyAndIdNot(String nameKey, Long id);
}
