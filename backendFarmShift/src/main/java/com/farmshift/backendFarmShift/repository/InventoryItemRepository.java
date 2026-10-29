package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.InventoryItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Sort;
import java.util.List;

public interface InventoryItemRepository extends JpaRepository<InventoryItem, Long> {
    // Fetch all fields used by InventoryItemResponse in one query, avoiding per-row lazy loads.
    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"warehouse", "product", "brand", "unit"})
    List<InventoryItem> findAllWithDetailsBy(Sort sort);
    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"warehouse", "product", "brand", "unit"})
    java.util.Optional<InventoryItem> findWithDetailsById(Long id);
    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"warehouse", "product", "brand", "unit"})
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
    boolean existsByUnit_IdAndStockGreaterThan(Long unitId, java.math.BigDecimal stock);
    /**
     * Trừ tồn kho nguyên tử, chỉ khi còn đủ: trả về 0 nếu kho không đủ. Hai người xác nhận cùng lúc không thể làm âm kho.
     */
    @org.springframework.data.jpa.repository.Modifying(flushAutomatically = true)
    @org.springframework.data.jpa.repository.Query("update InventoryItem i set i.stock = i.stock - :quantity where i.id = :id and i.stock >= :quantity")
    int takeStock(@org.springframework.data.repository.query.Param("id") Long id,
                  @org.springframework.data.repository.query.Param("quantity") java.math.BigDecimal quantity);

    @org.springframework.data.jpa.repository.Modifying(flushAutomatically = true)
    @org.springframework.data.jpa.repository.Query("update InventoryItem i set i.stock = i.stock + :quantity where i.id = :id")
    int returnStock(@org.springframework.data.repository.query.Param("id") Long id,
                    @org.springframework.data.repository.query.Param("quantity") java.math.BigDecimal quantity);
    boolean existsByWarehouse_IdAndProduct_IdAndIdNot(Long warehouseId, Long productId, Long id);
}
