package com.farmshift.backendFarmShift.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import lombok.Data;

import java.math.BigDecimal;

/**
 * Chi tiết phân bổ trừ kho FIFO cho một lần dùng thuốc điều trị bệnh,
 * giúp hoàn trả tồn kho chính xác 1:1 về từng đợt nhập gốc khi xóa/hoàn tác.
 */
@Embeddable
@Data
public class DiseaseTreatmentStockAllocation {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "inventory_item_id", nullable = false)
    private InventoryItem item;

    @Column(nullable = false, precision = 19, scale = 6)
    private BigDecimal quantity;
}
