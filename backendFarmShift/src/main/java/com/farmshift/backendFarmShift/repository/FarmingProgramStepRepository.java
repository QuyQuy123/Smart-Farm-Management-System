package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.FarmingProgramStep;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FarmingProgramStepRepository extends JpaRepository<FarmingProgramStep, Long> {
    boolean existsByInventoryItemId(Long inventoryItemId);
}
