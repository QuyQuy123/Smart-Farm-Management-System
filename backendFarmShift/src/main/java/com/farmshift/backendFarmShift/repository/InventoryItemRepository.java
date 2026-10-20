package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.InventoryItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Sort;
import java.util.List;

public interface InventoryItemRepository extends JpaRepository<InventoryItem, Long> {
    List<InventoryItem> findByWarehouse_Id(Long warehouseId, Sort sort);
    java.util.Optional<InventoryItem> findByWarehouse_IdAndProduct_Id(Long warehouseId, Long productId);
    java.util.List<InventoryItem> findByProduct_Id(Long productId);
    java.util.List<InventoryItem> findByProduct_NameContainingIgnoreCase(String name);
    long countByWarehouse_Id(Long warehouseId);
    long countByProduct_Id(Long productId);
    boolean existsByWarehouse_Id(Long warehouseId);
    boolean existsByProduct_Id(Long productId);
    boolean existsByBrand_Id(Long brandId);
    boolean existsByUnit_Id(Long unitId);
    boolean existsByWarehouse_IdAndProduct_IdAndIdNot(Long warehouseId, Long productId, Long id);
}
