package com.farmshift.backendFarmShift.dto.response;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record PurchaseInvoiceResponse(
    Long id,
    String code,
    LocalDate date,
    Long supplierId,
    String supplier,
    String supplierPhone,
    Long totalAmount,
    Long paidAmount,
    Long debtAmount,
    String paymentStatus,
    String stockStatus,
    Long discountAmount,
    Long otherCost,
    String referenceCode,
    String note,
    String attachmentUrl,
    List<Long> tagIds,
    List<String> tags,
    List<PurchaseInvoiceItemResponse> items,
    LocalDateTime createdAt,
    LocalDate importedDate,
    /** Đàn / lứa / chuồng nhận con giống khi hóa đơn được tạo từ thao tác nhập đàn; null với hóa đơn thường. */
    Long flockId,
    String flockCode,
    String flockName,
    Long cycleId,
    Integer cycleNumber,
    Long barnId,
    String barnName
) {
}
