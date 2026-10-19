package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.*;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface FarmingCycleRepository extends JpaRepository<FarmingCycle, Long> {
    Optional<FarmingCycle> findFirstByBarnIdAndStatus(Long barnId, CycleStatus status);
    List<FarmingCycle> findAllByBarnIdOrderByCycleNumberDesc(Long barnId);
    List<FarmingCycle> findAllByStatus(CycleStatus status);
    boolean existsByBarnId(Long barnId);

    @Query("select coalesce(max(c.cycleNumber), 0) from FarmingCycle c where c.barn.id = :barnId")
    int maxCycleNumber(@Param("barnId") Long barnId);
}
