package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.*;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface WeightSampleRepository extends JpaRepository<WeightSample, Long> {
    List<WeightSample> findAllByCycleIdOrderBySampleDateDescIdDesc(Long cycleId);
    Optional<WeightSample> findByIdAndCycleId(Long id, Long cycleId);

    @Query("select max(w.sampleDate) from WeightSample w where w.cycle.id = :cycleId")
    LocalDate lastSampleDate(@Param("cycleId") Long cycleId);
}
