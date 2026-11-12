package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.CycleCarriedExpense;
import com.farmshift.backendFarmShift.entity.ExpenseCategory;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface CycleCarriedExpenseRepository extends JpaRepository<CycleCarriedExpense, Long> {
    @EntityGraph(attributePaths = {"cycle"})
    List<CycleCarriedExpense> findAllWithCycleBy();

    List<CycleCarriedExpense> findAllByCycleId(Long cycleId);
    Optional<CycleCarriedExpense> findByCycleIdAndCategory(Long cycleId, ExpenseCategory category);
}
