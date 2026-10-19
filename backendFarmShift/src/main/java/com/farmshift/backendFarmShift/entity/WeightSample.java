package com.farmshift.backendFarmShift.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** Thông số vật nuôi: lần cân mẫu để theo dõi trọng lượng trung bình của lứa. */
@Entity
@Table(name = "weight_samples")
@Data
public class WeightSample {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cycle_id", nullable = false)
    private FarmingCycle cycle;
    @Column(name = "sample_date", nullable = false)
    private LocalDate sampleDate;
    @Column(name = "avg_weight_kg", nullable = false, precision = 8, scale = 3)
    private BigDecimal avgWeightKg;
    @Column(name = "sample_size")
    private Integer sampleSize;
    @Column(length = 1000)
    private String note;
    @Column(name = "created_by", length = 150)
    private String createdBy;
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
