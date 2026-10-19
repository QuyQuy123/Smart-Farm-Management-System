package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.Supplier;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SupplierRepository extends JpaRepository<Supplier, Long> {
    boolean existsByNameKeyAndIdNot(String key, Long id);
    boolean existsByProductType_Id(Long id);
    java.util.Optional<Supplier> findByNameKey(String nameKey);
}
