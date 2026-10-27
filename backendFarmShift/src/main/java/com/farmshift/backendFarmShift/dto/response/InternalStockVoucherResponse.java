package com.farmshift.backendFarmShift.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record InternalStockVoucherResponse(
    Long id,
    String code,
    String movementType,
    Long categoryId,
    String categoryName,
    Long sourceWarehouseId,
    String sourceWarehouseName,
    Long targetWarehouseId,
    String targetWarehouseName,
    Long cycleId,
    String cycleCode,
    Long expenseId,
    LocalDate movementDate,
    BigDecimal totalAmount,
    String status,
    String note,
    String attachmentUrl,
    String createdBy,
    LocalDateTime createdAt,
    List<InternalStockVoucherItemResponse> items
) {}
