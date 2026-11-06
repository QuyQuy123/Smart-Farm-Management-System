package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.WarehouseCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface WarehouseCategoryRepository extends JpaRepository<WarehouseCategory, Long> {
    List<WarehouseCategory> findDistinctByWorkers_IdIn(Collection<Long> workerIds);
    boolean existsByNameKey(String nameKey);
    boolean existsByNameKeyAndIdNot(String nameKey, Long id);
    Optional<WarehouseCategory> findByNameKey(String nameKey);

    @Query("SELECT CASE WHEN COUNT(w) > 0 THEN true ELSE false END FROM WarehouseCategory w LEFT JOIN w.areas a WHERE (w.area.id = :areaId OR a.id = :areaId) AND w.kind = :kind")
    boolean existsByArea_IdAndKind(@Param("areaId") Long areaId, @Param("kind") String kind);

    @Query("SELECT DISTINCT w FROM WarehouseCategory w LEFT JOIN w.areas a WHERE w.area.id = :areaId OR a.id = :areaId")
    List<WarehouseCategory> findAllByArea_Id(@Param("areaId") Long areaId);
}
