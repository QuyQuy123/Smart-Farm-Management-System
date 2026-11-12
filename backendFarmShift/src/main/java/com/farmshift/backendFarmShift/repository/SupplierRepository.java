package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.Supplier;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SupplierRepository extends JpaRepository<Supplier, Long> {
    @EntityGraph(attributePaths = {"productType"})
    java.util.List<Supplier> findAll(Sort sort);
    boolean existsByNameKeyAndIdNot(String key, Long id);
    boolean existsByProductType_Id(Long id);
    java.util.List<Supplier> findByNameIgnoreCase(String name);
}
