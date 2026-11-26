package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.CycleDisease;
import com.farmshift.backendFarmShift.entity.DiseaseStatus;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface CycleDiseaseRepository extends JpaRepository<CycleDisease, Long> {
    @EntityGraph(attributePaths = {"flock", "cycle"})
    List<CycleDisease> findAllByCycleIdOrderByStartDateDescIdDesc(Long cycleId);

    @EntityGraph(attributePaths = {"flock", "cycle"})
    Optional<CycleDisease> findByIdAndCycleId(Long id, Long cycleId);

    List<CycleDisease> findAllByCycleIdIn(Collection<Long> cycleIds);

    List<CycleDisease> findAllByCycleIdAndStatus(Long cycleId, DiseaseStatus status);

    @Query("select max(d.startDate) from CycleDisease d where d.cycle.id = :cycleId")
    LocalDate lastStartDate(@Param("cycleId") Long cycleId);

    @Query("select max(d.endDate) from CycleDisease d where d.cycle.id = :cycleId")
    LocalDate lastEndDate(@Param("cycleId") Long cycleId);
}
