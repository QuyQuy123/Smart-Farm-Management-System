package com.farmshift.backendFarmShift.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;

/** Original lot and package quantity for exact undo, even after assignments/specifications change. */
@Embeddable
@Data
public class DailyStockAllocation {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "inventory_item_id", nullable = false)
    private InventoryItem item;
    @Column(nullable = false, precision = 19, scale = 6)
    private BigDecimal quantity;
}
