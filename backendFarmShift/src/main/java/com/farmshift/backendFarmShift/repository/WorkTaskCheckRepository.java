package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.WorkTaskCheck;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface WorkTaskCheckRepository extends JpaRepository<WorkTaskCheck, Long> {
    List<WorkTaskCheck> findAllByTaskIdInAndCheckDate(Collection<Long> taskIds, LocalDate checkDate);
    Optional<WorkTaskCheck> findByTaskIdAndCheckDate(Long taskId, LocalDate checkDate);
    boolean existsByTaskIdAndCheckDate(Long taskId, LocalDate checkDate);
    boolean existsByTaskId(Long taskId);
    boolean existsByTaskIdAndCheckDateGreaterThan(Long taskId, LocalDate checkDate);
    @Modifying(flushAutomatically = true)
    void deleteAllByTaskId(Long taskId);
    @Modifying(flushAutomatically = true)
    void deleteAllByTaskBarnId(Long barnId);
}
