package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.WorkTask;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDate;
import java.util.List;

public interface WorkTaskRepository extends JpaRepository<WorkTask, Long> {
    /** Việc có hiệu lực trong ngày (start_date ≤ ngày ≤ end_date), sắp theo giờ rồi theo thứ tự tạo. */
    @Query("""
            select t from WorkTask t join fetch t.assignee join fetch t.barn
            where t.startDate <= :date and t.endDate >= :date
            order by case when t.dueTime is null then 1 else 0 end, t.dueTime, t.id""")
    List<WorkTask> findActiveOn(@Param("date") LocalDate date);

    @Query("""
            select t from WorkTask t join fetch t.assignee
            where t.barn.id = :barnId and t.startDate <= :date and t.endDate >= :date
            order by case when t.dueTime is null then 1 else 0 end, t.dueTime, t.id""")
    List<WorkTask> findActiveOnForBarn(@Param("barnId") Long barnId, @Param("date") LocalDate date);

    boolean existsByBarnIdAndAssigneeIdAndEndDateGreaterThanEqual(Long barnId, Long assigneeId, LocalDate date);

    @Modifying(flushAutomatically = true)
    void deleteAllByBarnId(Long barnId);
}
