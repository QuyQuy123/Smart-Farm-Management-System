package com.farmshift.backendFarmShift.dto.response;

import java.time.LocalDateTime;

public record SupplierResponse(Long id, String name, String representative, String phone,
                               Long productTypeId, String productTypeName, LocalDateTime createdAt) {
}
