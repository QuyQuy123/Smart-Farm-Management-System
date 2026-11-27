package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.BarnRoutineTaskCheck;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface BarnRoutineTaskCheckRepository extends JpaRepository<BarnRoutineTaskCheck, Long> {
    List<BarnRoutineTaskCheck> findAllByCycleIdAndCheckDate(Long cycleId, LocalDate checkDate);

    List<BarnRoutineTaskCheck> findAllByCycleIdInAndCheckDateBetween(Collection<Long> cycleIds, LocalDate from, LocalDate to);

    Optional<BarnRoutineTaskCheck> findByCycleIdAndCheckDateAndTaskCode(Long cycleId, LocalDate checkDate, String taskCode);

    boolean existsByCycleIdAndCheckDateAndTaskCode(Long cycleId, LocalDate checkDate, String taskCode);
}
