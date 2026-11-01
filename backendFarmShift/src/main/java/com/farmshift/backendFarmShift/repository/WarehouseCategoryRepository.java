package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.WarehouseCategory;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WarehouseCategoryRepository extends JpaRepository<WarehouseCategory, Long> {
    java.util.List<WarehouseCategory> findDistinctByWorkers_IdIn(java.util.Collection<Long> workerIds);
    boolean existsByNameKey(String nameKey);
    boolean existsByNameKeyAndIdNot(String nameKey, Long id);
    java.util.Optional<WarehouseCategory> findByNameKey(String nameKey);
    boolean existsByArea_IdAndKind(Long areaId, String kind);
    java.util.List<WarehouseCategory> findAllByArea_Id(Long areaId);
}
