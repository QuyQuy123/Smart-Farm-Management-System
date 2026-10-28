package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.InternalStockCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;
import java.util.Optional;

public interface InternalStockCategoryRepository extends JpaRepository<InternalStockCategory, Long> {
    Optional<InternalStockCategory> findByNameKey(String nameKey);
    boolean existsByNameKey(String nameKey);
    boolean existsByNameKeyAndIdNot(String nameKey, Long id);
    List<InternalStockCategory> findByMovementType(String movementType);

    @Query("SELECT c, (SELECT COUNT(v) FROM InternalStockVoucher v WHERE v.category = c AND v.status != 'CANCELLED') " +
           "FROM InternalStockCategory c ORDER BY c.id ASC")
    List<Object[]> findAllWithVoucherCount();
}
