package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.InternalStockVoucherItem;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InternalStockVoucherItemRepository extends JpaRepository<InternalStockVoucherItem, Long> {
    boolean existsByProduct_Id(Long productId);
}
