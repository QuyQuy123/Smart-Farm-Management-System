package com.farmshift.backendFarmShift.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** Biến động số con của một đàn (nhập, chuyển, hao hụt, loại thải, xuất bán). */
@Entity
@Table(name = "flock_movements")
@Data
public class FlockMovement {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "flock_id", nullable = false)
    private Flock flock;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private FlockMovementType type;
    @Column(name = "movement_date", nullable = false)
    private LocalDate movementDate;
    @Column(nullable = false)
    private int quantity;
    /** Tổng khối lượng (kg) của số con biến động, nếu có cân. */
    @Column(name = "weight_kg", precision = 14, scale = 3)
    private BigDecimal weightKg;
    /** Đơn giá bán (đ/kg) với xuất bán. */
    @Column(name = "unit_price", precision = 14, scale = 2)
    private BigDecimal unitPrice;
    /** Đàn đối ứng khi chuyển đàn. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "related_flock_id")
    private Flock relatedFlock;
    @Column(length = 1000)
    private String note;
    @Column(name = "created_by", length = 150)
    private String createdBy;
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
