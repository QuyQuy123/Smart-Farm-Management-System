package com.farmshift.backendFarmShift.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;

@Entity
@Table(name = "internal_stock_voucher_items")
@Data
public class InternalStockVoucherItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "voucher_id", nullable = false)
    private InternalStockVoucher voucher;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private ProductCategory product;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_inventory_item_id")
    private InventoryItem sourceInventoryItem;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "target_inventory_item_id")
    private InventoryItem targetInventoryItem;

    @Column(nullable = false, precision = 19, scale = 3)
    private BigDecimal quantity = BigDecimal.ZERO;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "unit_id")
    private MeasurementUnit unit;

    @Column(name = "unit_price", nullable = false, precision = 19, scale = 2)
    private BigDecimal unitPrice = BigDecimal.ZERO;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal amount = BigDecimal.ZERO;

    @Column(length = 500)
    private String note;
}
