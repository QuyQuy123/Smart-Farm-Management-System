package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.DailyTaskLog;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface DailyTaskLogRepository extends JpaRepository<DailyTaskLog, Long> {
    List<DailyTaskLog> findAllByCycleIdAndTaskDate(Long cycleId, LocalDate taskDate);
    List<DailyTaskLog> findAllByCycleIdInAndTaskDateBetween(List<Long> cycleIds, LocalDate from, LocalDate to);
    Optional<DailyTaskLog> findByCycleIdAndTaskDateAndTaskKey(Long cycleId, LocalDate taskDate, String taskKey);
    boolean existsByCycleIdAndTaskDateAndTaskKey(Long cycleId, LocalDate taskDate, String taskKey);
    boolean existsByFeedRecordId(Long feedRecordId);
    boolean existsByExpenseId(Long expenseId);
    boolean existsByInventoryItemId(Long inventoryItemId);
    boolean existsByStockAllocations_Item_Id(Long inventoryItemId);
}
