package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.CycleDisease;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface CycleDiseaseRepository extends JpaRepository<CycleDisease, Long> {
    @EntityGraph(attributePaths = {"flock", "cycle"})
    List<CycleDisease> findAllByCycleIdOrderByStartDateDescIdDesc(Long cycleId);

    @EntityGraph(attributePaths = {"flock", "cycle"})
    Optional<CycleDisease> findByIdAndCycleId(Long id, Long cycleId);

    List<CycleDisease> findAllByCycleIdIn(Collection<Long> cycleIds);
}
