package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.*;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface FlockMovementRepository extends JpaRepository<FlockMovement, Long> {
    @EntityGraph(attributePaths = {"flock", "flock.cycle"})
    List<FlockMovement> findAllByOrderByMovementDateAscIdAsc();

    @EntityGraph(attributePaths = {"flock", "flock.cycle"})
    List<FlockMovement> findByFlock_Cycle_IdInOrderByMovementDateAscIdAsc(List<Long> cycleIds);

    @EntityGraph(attributePaths = {"flock", "flock.cycle", "flock.cycle.barn", "flock.cycle.barn.area", "flock.program"})
    @Query("select m from FlockMovement m where m.type = com.farmshift.backendFarmShift.entity.FlockMovementType.HARVEST and m.movementDate between :from and :to order by m.movementDate asc, m.id asc")
    List<FlockMovement> findHarvestInDateRangeForReport(@Param("from") LocalDate from, @Param("to") LocalDate to);

    @EntityGraph(attributePaths = {"flock", "relatedFlock"})
    List<FlockMovement> findAllByFlock_Cycle_IdOrderByMovementDateAscIdAsc(Long cycleId);

    @Query("select max(m.movementDate) from FlockMovement m where m.flock.cycle.id = :cycleId")
    LocalDate lastMovementDate(@Param("cycleId") Long cycleId);
}
