package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.PurchaseInvoiceItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PurchaseInvoiceItemRepository extends JpaRepository<PurchaseInvoiceItem, Long> {
    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = "invoice")
    List<PurchaseInvoiceItem> findByIdIn(java.util.Collection<Long> ids);
    List<PurchaseInvoiceItem> findByInvoiceId(Long invoiceId);
}
