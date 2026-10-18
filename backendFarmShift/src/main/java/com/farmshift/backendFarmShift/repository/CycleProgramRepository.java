package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.*;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface CycleProgramRepository extends JpaRepository<CycleProgram, Long> {
    @EntityGraph(attributePaths = {"program", "program.steps"})
    List<CycleProgram> findAllByCycleIdOrderByIdAsc(Long cycleId);
    Optional<CycleProgram> findByCycleIdAndProgramId(Long cycleId, Long programId);
    boolean existsByCycleIdAndProgramId(Long cycleId, Long programId);
    boolean existsByProgramId(Long programId);
    long countByProgramIdAndCycleStatus(Long programId, CycleStatus status);
}
