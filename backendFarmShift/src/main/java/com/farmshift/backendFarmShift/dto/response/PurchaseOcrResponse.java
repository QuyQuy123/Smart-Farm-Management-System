package com.farmshift.backendFarmShift.dto.response;

import com.farmshift.backendFarmShift.dto.request.PurchaseInvoiceItemRequest;

import java.time.LocalDate;
import java.util.List;

public record PurchaseOcrResponse(
    Long supplierId,
    String supplierName,
    String supplierTaxCode,
    LocalDate invoiceDate,
    String referenceCode,
    List<PurchaseInvoiceItemRequest> items,
    Long discountAmount,
    Long otherCost,
    Long totalAmount,
    String paymentStatus,
    Long paidAmount,
    Double confidence,
    String note,
    List<String> warnings,
    String messageCode
) {
}
