package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.PurchaseInvoice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PurchaseInvoiceRepository extends JpaRepository<PurchaseInvoice, Long> {
    Optional<PurchaseInvoice> findByCode(String code);

    @Query("SELECT p FROM PurchaseInvoice p " +
           "LEFT JOIN FETCH p.supplier s " +
           "WHERE (:search IS NULL OR :search = '' OR LOWER(p.code) LIKE LOWER(CONCAT('%', :search, '%')) OR LOWER(s.name) LIKE LOWER(CONCAT('%', :search, '%'))) " +
           "AND (:paymentStatus IS NULL OR :paymentStatus = '' OR :paymentStatus = 'ALL' OR p.paymentStatus LIKE CONCAT('%', :paymentStatus, '%')) " +
           "ORDER BY p.invoiceDate DESC, p.id DESC")
    List<PurchaseInvoice> searchInvoices(@Param("search") String search, @Param("paymentStatus") String paymentStatus);

    Optional<PurchaseInvoice> findTopByOrderByIdDesc();

    /** Hóa đơn nhập con giống của các đàn (không tính hóa đơn đã hủy). */
    @Query("SELECT p FROM PurchaseInvoice p WHERE p.flock.id IN :flockIds AND p.stockStatus <> 'Đã hủy' ORDER BY p.id")
    List<PurchaseInvoice> findAllByFlockIdIn(@Param("flockIds") List<Long> flockIds);

    @Query("SELECT COALESCE(SUM(p.totalAmount), 0) FROM PurchaseInvoice p WHERE p.supplier.id = :supplierId AND p.stockStatus <> 'Đã hủy'")
    Long calculateTotalPurchasedBySupplier(@Param("supplierId") Long supplierId);

    @Query("SELECT COALESCE(SUM(p.totalAmount - p.paidAmount), 0) FROM PurchaseInvoice p WHERE p.supplier.id = :supplierId AND p.stockStatus <> 'Đã hủy'")
    Long calculateCurrentDebtBySupplier(@Param("supplierId") Long supplierId);
}
