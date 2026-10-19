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
    @EntityGraph(attributePaths = {"flock", "relatedFlock"})
    List<FlockMovement> findAllByFlock_Cycle_IdOrderByMovementDateAscIdAsc(Long cycleId);

    @Query("select max(m.movementDate) from FlockMovement m where m.flock.cycle.id = :cycleId")
    LocalDate lastMovementDate(@Param("cycleId") Long cycleId);
}
