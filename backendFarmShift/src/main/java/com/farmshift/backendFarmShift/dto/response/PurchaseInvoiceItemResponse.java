package com.farmshift.backendFarmShift.dto.response;

public record PurchaseInvoiceItemResponse(
    Long id,
    Long productCategoryId,
    String name,
    Double qty,
    String unit,
    Long price,
    Double vatRate,
    Long amount
) {
}
