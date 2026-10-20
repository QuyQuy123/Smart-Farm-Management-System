package com.farmshift.backendFarmShift.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** Lứa nuôi: một đợt nuôi trong một chuồng, từ lúc khai báo đến khi xuất hết đàn. */
@Entity
@Table(name = "farming_cycles", uniqueConstraints = @UniqueConstraint(name = "uk_cycles_barn_number", columnNames = {"barn_id", "cycle_number"}))
@Data
public class FarmingCycle {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "barn_id", nullable = false)
    private Barn barn;
    /** Thứ tự lứa trong chuồng: 1, 2, 3... */
    @Column(name = "cycle_number", nullable = false)
    private int cycleNumber;
    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;
    /** Ngày nở (ngày tuổi 1) của con giống, dùng để tính ngày tuổi. */
    @Column(name = "hatch_date")
    private LocalDate hatchDate;
    @Column(name = "end_date")
    private LocalDate endDate;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private CycleStatus status;
    @Column(length = 1000)
    private String note;
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
