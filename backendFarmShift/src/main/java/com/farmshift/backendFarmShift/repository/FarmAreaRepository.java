package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.FarmArea;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface FarmAreaRepository extends JpaRepository<FarmArea, Long> {
    @EntityGraph(attributePaths = "workers")
    List<FarmArea> findAllWithWorkersByOrderByCreatedAtAscIdAsc();

    @Query("SELECT a.id, w.id FROM FarmArea a JOIN a.warehouses w")
    List<Object[]> findAreaWarehousePairs();

    boolean existsByNameKey(String nameKey);
    boolean existsByNameKeyAndIdNot(String nameKey, Long id);
}
