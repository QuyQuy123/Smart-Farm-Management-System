package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.DiseaseTreatmentLog;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface DiseaseTreatmentLogRepository extends JpaRepository<DiseaseTreatmentLog, Long> {
    @EntityGraph(attributePaths = {"inventoryItem", "inventoryItem.product", "inventoryItem.unit", "inventoryItem.warehouse", "expense"})
    List<DiseaseTreatmentLog> findAllByDiseaseIdInOrderByTreatmentDateAscIdAsc(Collection<Long> diseaseIds);

    @EntityGraph(attributePaths = {"inventoryItem", "inventoryItem.product", "inventoryItem.unit", "inventoryItem.warehouse", "expense"})
    List<DiseaseTreatmentLog> findAllByDiseaseIdOrderByTreatmentDateAscIdAsc(Long diseaseId);

    Optional<DiseaseTreatmentLog> findByIdAndDiseaseId(Long id, Long diseaseId);

    boolean existsByDiseaseId(Long diseaseId);

    boolean existsByExpenseId(Long expenseId);

    boolean existsByInventoryItemId(Long inventoryItemId);

    boolean existsByStockAllocations_Item_Id(Long inventoryItemId);
}
