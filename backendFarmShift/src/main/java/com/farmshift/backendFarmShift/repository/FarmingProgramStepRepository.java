package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.FarmingProgramStep;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface FarmingProgramStepRepository extends JpaRepository<FarmingProgramStep, Long> {
    boolean existsByInventoryItemId(Long inventoryItemId);

    @EntityGraph(attributePaths = {"program", "inventoryItem", "inventoryItem.product", "inventoryItem.warehouse", "inventoryItem.unit"})
    List<FarmingProgramStep> findAllByOrderByProgramIdAscDayFromAscIdAsc();
}
