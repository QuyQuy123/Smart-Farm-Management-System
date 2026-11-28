package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.*;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface FlockRepository extends JpaRepository<Flock, Long> {
    @EntityGraph(attributePaths = {"cycle", "program", "supplier"})
    List<Flock> findAllByOrderByImportDateAscIdAsc();

    @EntityGraph(attributePaths = {"cycle", "program", "supplier"})
    List<Flock> findByCycleIdInOrderByImportDateAscIdAsc(List<Long> cycleIds);

    @EntityGraph(attributePaths = {"cycle", "cycle.barn"})
    List<Flock> findWithCycleAndBarnByIdIn(java.util.Collection<Long> ids);

    List<Flock> findAllByCycleIdOrderByImportDateAscIdAsc(Long cycleId);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select f from Flock f where f.cycle.id = :cycleId order by f.importDate asc, f.id asc")
    List<Flock> findAllByCycleIdForUpdate(@Param("cycleId") Long cycleId);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select f from Flock f where f.id = :id")
    Optional<Flock> findByIdForUpdate(@Param("id") Long id);
    boolean existsByProgramId(Long programId);
    boolean existsBySupplierId(Long supplierId);
    long countByProgramIdAndStatus(Long programId, FlockStatus status);
}
