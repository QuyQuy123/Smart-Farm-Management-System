package com.farmshift.backendFarmShift.dto.response;

import java.time.LocalDate;

public record PurchaseInvoiceItemResponse(
    Long id,
    Long productCategoryId,
    String name,
    Double qty,
    String unit,
    Long price,
    Double vatRate,
    Long amount,
    Long warehouseId,
    String lotNumber,
    LocalDate expiryDate
) {
    public PurchaseInvoiceItemResponse(Long id, Long productCategoryId, String name, Double qty, String unit,
                                       Long price, Double vatRate, Long amount, Long warehouseId) {
        this(id, productCategoryId, name, qty, unit, price, vatRate, amount, warehouseId, null, null);
    }
}
