package com.farmshift.backendFarmShift.dto.response;

import java.util.List;

public record InventoryAlertSummaryResponse(
        int totalAlerts,
        int lowStockCount,
        int expiredCount,
        int nearExpiryCount,
        List<InventoryItemResponse> items
) {
}

