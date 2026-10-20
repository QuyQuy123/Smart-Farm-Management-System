package com.farmshift.backendFarmShift.dto.request;
import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.util.List;
public record PurchaseInvoiceEditRequest(
    @NotNull @Positive Long supplierId,
    @NotNull LocalDate date,
    @Size(max=100) String referenceCode,
    @Size(max=1000) String note,
    @Size(max=100) List<@NotNull @Positive Long> tagIds,
    @NotEmpty @Size(max=200) List<@NotNull @jakarta.validation.Valid PurchaseInvoiceItemRequest> items,
    @NotNull @Min(0) Long discountAmount,
    @NotNull @Min(0) Long otherCost) {}
