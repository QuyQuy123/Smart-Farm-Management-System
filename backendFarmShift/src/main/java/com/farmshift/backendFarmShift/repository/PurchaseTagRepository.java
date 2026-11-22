package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.PurchaseTag;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface PurchaseTagRepository extends JpaRepository<PurchaseTag, Long> {
    boolean existsByNameKey(String nameKey);
    boolean existsByNameKeyAndIdNot(String nameKey, Long id);
    Optional<PurchaseTag> findByNameKey(String nameKey);

    @Query("SELECT (COUNT(s) + COUNT(p)) FROM PurchaseTag t " +
           "LEFT JOIN Supplier s ON t MEMBER OF s.tags AND t.id = :tagId " +
           "LEFT JOIN PurchaseInvoice p ON t MEMBER OF p.tags AND t.id = :tagId " +
           "WHERE t.id = :tagId")
    long countUsage(@Param("tagId") Long tagId);

    @Query("SELECT t.id, COUNT(s) FROM Supplier s JOIN s.tags t GROUP BY t.id")
    java.util.List<Object[]> countSupplierUsageByTag();

    @Query("SELECT t.id, COUNT(p) FROM PurchaseInvoice p JOIN p.tags t GROUP BY t.id")
    java.util.List<Object[]> countInvoiceUsageByTag();
}
