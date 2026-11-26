package com.farmshift.backendFarmShift.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Lượng cám lẻ đang mở bao còn lại tại chuồng cho một lứa nuôi và một loại cám (sản phẩm).
 * Kho tổng luôn trừ chẵn nguyên bao; phần kg dư sau khi mở bao được giữ tại đây để các cữ sau dùng tiếp.
 */
@Entity
@Table(name = "cycle_opened_feeds",
        uniqueConstraints = @UniqueConstraint(name = "uk_cycle_opened_feeds_cycle_product", columnNames = {"cycle_id", "product_id"}),
        indexes = @Index(name = "idx_cycle_opened_feeds_cycle", columnList = "cycle_id"))
@Data
public class CycleOpenedFeed {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cycle_id", nullable = false)
    private FarmingCycle cycle;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private ProductCategory product;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "warehouse_id")
    private WarehouseCategory warehouse;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "unit_id")
    private MeasurementUnit unit;

    @Column(name = "kg_per_bag", nullable = false, precision = 12, scale = 3)
    private BigDecimal kgPerBag;

    @Column(name = "remaining_kg", nullable = false, precision = 14, scale = 3)
    private BigDecimal remainingKg = BigDecimal.ZERO;

    @Column(name = "remaining_value", nullable = false, precision = 16, scale = 2)
    private BigDecimal remainingValue = BigDecimal.ZERO;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
