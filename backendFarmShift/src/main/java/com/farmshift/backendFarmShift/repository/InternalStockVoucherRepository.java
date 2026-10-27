package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.InternalStockVoucher;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import java.util.Optional;

public interface InternalStockVoucherRepository extends JpaRepository<InternalStockVoucher, Long>, JpaSpecificationExecutor<InternalStockVoucher> {
    Optional<InternalStockVoucher> findByCode(String code);
    boolean existsByCode(String code);
    long countByCategory_IdAndStatusNot(Long categoryId, String status);
    boolean existsBySourceWarehouse_IdOrTargetWarehouse_Id(Long sourceWarehouseId, Long targetWarehouseId);

    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {
            "category", "sourceWarehouse", "targetWarehouse", "cycle", "expense",
            "items", "items.product", "items.unit"
    })
    @org.springframework.data.jpa.repository.Query("SELECT v FROM InternalStockVoucher v WHERE v.id = :id")
    Optional<InternalStockVoucher> findWithDetailsById(@org.springframework.data.repository.query.Param("id") Long id);
}
