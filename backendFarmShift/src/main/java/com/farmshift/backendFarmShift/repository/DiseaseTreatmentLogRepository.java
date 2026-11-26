package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.DiseaseTreatmentLog;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface DiseaseTreatmentLogRepository extends JpaRepository<DiseaseTreatmentLog, Long> {
    @EntityGraph(attributePaths = {"inventoryItem", "inventoryItem.product", "inventoryItem.unit", "inventoryItem.warehouse", "expense"})
    List<DiseaseTreatmentLog> findAllByDiseaseIdInOrderByTreatmentDateAscIdAsc(Collection<Long> diseaseIds);

    @EntityGraph(attributePaths = {"inventoryItem", "inventoryItem.product", "inventoryItem.unit", "inventoryItem.warehouse", "expense"})
    List<DiseaseTreatmentLog> findAllByDiseaseIdOrderByTreatmentDateAscIdAsc(Long diseaseId);

    Optional<DiseaseTreatmentLog> findByIdAndDiseaseId(Long id, Long diseaseId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from DiseaseTreatmentLog t where t.id = :id and t.disease.id = :diseaseId")
    Optional<DiseaseTreatmentLog> findByIdAndDiseaseIdForUpdate(@Param("id") Long id, @Param("diseaseId") Long diseaseId);

    @Query("select max(t.treatmentDate) from DiseaseTreatmentLog t where t.disease.cycle.id = :cycleId")
    LocalDate lastTreatmentDate(@Param("cycleId") Long cycleId);

    boolean existsByDiseaseId(Long diseaseId);

    boolean existsByExpenseId(Long expenseId);

    boolean existsByInventoryItemId(Long inventoryItemId);

    boolean existsByStockAllocations_Item_Id(Long inventoryItemId);
}
