package com.farmshift.backendFarmShift.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.Pattern;

import java.time.LocalDate;
import java.util.List;

public record PurchaseInvoiceRequest(
    Long supplierId,
    String supplierName,
    @NotNull(message = "Vui lòng chọn ngày lập hóa đơn.") LocalDate date,
    @NotEmpty(message = "Hóa đơn phải có ít nhất một mặt hàng.") @Valid List<PurchaseInvoiceItemRequest> items,
    @Min(value=0, message="Chiết khấu không được âm.") Long discountAmount,
    @Min(value=0, message="Chi phí khác không được âm.") Long otherCost,
    @Min(value=0, message="Tiền trả trước không được âm.") Long paidAmount,
    String paymentStatus,
    String stockStatus,
    @Size(max=100) @Pattern(regexp="^[\\p{L}\\p{N}\\s._/()\\-]*$", message="Số chứng từ chứa ký tự không hợp lệ.") String referenceCode,
    @Size(max=1000) @Pattern(regexp="(?s)^(?:\\s*|.*\\p{L}.*)$", message="Ghi chú phải có nội dung chữ.") String note,
    String attachmentUrl,
    List<Long> tagIds
) {
}
