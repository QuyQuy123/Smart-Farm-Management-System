package com.farmshift.backendFarmShift.dto.response;

import java.time.LocalDateTime;
import java.util.List;

public record SupplierResponse(
    Long id,
    String name,
    String representative,
    String phone,
    Long productTypeId,
    String productTypeName,
    LocalDateTime createdAt,
    String email,
    String address,
    String taxCode,
    String bankName,
    String bankAccount,
    String paymentPolicy,
    Long openingDebt,
    String note,
    List<Long> tagIds,
    List<String> tagNames,
    Long totalPurchased,
    Long debt
) {
    public SupplierResponse(Long id, String name, String representative, String phone,
                            Long productTypeId, String productTypeName, LocalDateTime createdAt) {
        this(id, name, representative, phone, productTypeId, productTypeName, createdAt,
             null, null, null, null, null, null, 0L, null, List.of(), List.of(), 0L, 0L);
    }
}
