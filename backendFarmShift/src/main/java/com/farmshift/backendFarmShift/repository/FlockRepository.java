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
    List<Flock> findAllByCycleIdOrderByImportDateAscIdAsc(Long cycleId);
    boolean existsByProgramId(Long programId);
    long countByProgramIdAndStatus(Long programId, FlockStatus status);
}
