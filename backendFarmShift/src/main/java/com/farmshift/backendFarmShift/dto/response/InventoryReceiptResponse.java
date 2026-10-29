package com.farmshift.backendFarmShift.dto.response;

import java.time.LocalDate;

/** Original purchase data, independent of the lot's remaining stock or editable display price. */
public record InventoryReceiptResponse(Long invoiceId, String invoiceCode, LocalDate importedDate,
                                       Double quantity, String unit, Long price) {}
