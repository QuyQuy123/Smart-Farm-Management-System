package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.InventoryItem;
import com.farmshift.backendFarmShift.entity.ProductCategory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface InventoryItemRepository extends JpaRepository<InventoryItem, Long> {
    Optional<InventoryItem> findByProductCategory(ProductCategory productCategory);
    Optional<InventoryItem> findByProductNameKey(String productNameKey);
    List<InventoryItem> findByProductNameContainingIgnoreCase(String name);
}
