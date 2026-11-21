package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.*;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface FarmingProgramRepository extends JpaRepository<FarmingProgram, Long> {
    boolean existsByNameKey(String nameKey);
    boolean existsByNameKeyAndIdNot(String nameKey, Long id);
    @EntityGraph(attributePaths = "steps")
    List<FarmingProgram> findAllByOrderByNameAsc();

    @EntityGraph(attributePaths = {"steps", "steps.inventoryItem", "steps.inventoryItem.product", "steps.inventoryItem.unit"})
    List<FarmingProgram> findAllWithStepsByIdIn(Collection<Long> ids);
}
