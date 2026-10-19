package com.farmshift.backendFarmShift.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.util.List;

public record PurchaseInvoiceRequest(
    Long supplierId,
    String supplierName,
    @NotNull(message = "Vui lòng chọn ngày lập hóa đơn.") LocalDate date,
    @NotEmpty(message = "Hóa đơn phải có ít nhất một mặt hàng.") @Valid List<PurchaseInvoiceItemRequest> items,
    Long discountAmount,
    Long otherCost,
    Long paidAmount,
    String paymentStatus,
    String stockStatus,
    String referenceCode,
    String note,
    String attachmentUrl,
    List<Long> tagIds
) {
}
