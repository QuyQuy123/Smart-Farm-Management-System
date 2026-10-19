package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.*;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface FeedRecordRepository extends JpaRepository<FeedRecord, Long> {
    List<FeedRecord> findAllByCycleIdOrderByRecordDateDescIdDesc(Long cycleId);
    Optional<FeedRecord> findByIdAndCycleId(Long id, Long cycleId);

    @Query("select max(f.recordDate) from FeedRecord f where f.cycle.id = :cycleId")
    LocalDate lastRecordDate(@Param("cycleId") Long cycleId);
}
