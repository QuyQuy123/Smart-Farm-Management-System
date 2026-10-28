package com.farmshift.backendFarmShift.dto.response;

import java.util.List;

public record InternalStockVoucherPageResponse(
    List<InternalStockVoucherResponse> content,
    int page,
    int size,
    long totalElements,
    int totalPages
) {}
