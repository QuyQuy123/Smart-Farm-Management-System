package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.PurchasePayment;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PurchasePaymentRepository extends JpaRepository<PurchasePayment, Long> {
    @EntityGraph(attributePaths = {"invoice", "supplier"})
    List<PurchasePayment> findBySupplier_IdOrderByPaymentDateDescIdDesc(Long supplierId);

    @EntityGraph(attributePaths = {"invoice", "supplier"})
    List<PurchasePayment> findByInvoice_IdOrderByPaymentDateDescIdDesc(Long invoiceId);

    boolean existsByInvoice_Id(Long invoiceId);
}

