package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.*;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface CycleExpenseRepository extends JpaRepository<CycleExpense, Long> {
    List<CycleExpense> findAllByCycleIdOrderByExpenseDateDescIdDesc(Long cycleId);
    Optional<CycleExpense> findByIdAndCycleId(Long id, Long cycleId);

    @Query("select max(e.expenseDate) from CycleExpense e where e.cycle.id = :cycleId")
    LocalDate lastExpenseDate(@Param("cycleId") Long cycleId);
}
