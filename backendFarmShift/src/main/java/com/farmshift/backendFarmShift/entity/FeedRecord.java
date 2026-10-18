package com.farmshift.backendFarmShift.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** Nhật ký cám: lượng thức ăn đã cho ăn trong lứa. */
@Entity
@Table(name = "feed_records")
@Data
public class FeedRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cycle_id", nullable = false)
    private FarmingCycle cycle;
    @Column(name = "record_date", nullable = false)
    private LocalDate recordDate;
    @Column(name = "feed_name", nullable = false, length = 150)
    private String feedName;
    @Column(name = "quantity_kg", nullable = false, precision = 14, scale = 3)
    private BigDecimal quantityKg;
    /** Đơn giá cám (đ/kg), dùng để hạch toán chi phí. */
    @Column(name = "unit_price", nullable = false, precision = 14, scale = 2)
    private BigDecimal unitPrice;
    @Column(length = 1000)
    private String note;
    @Column(name = "created_by", length = 150)
    private String createdBy;
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
