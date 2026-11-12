package com.farmshift.backendFarmShift.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "cycle_cost_allocations")
@Data
@NoArgsConstructor
public class CycleCostAllocation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 30)
    private String code;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cycle_id", foreignKey = @ForeignKey(name = "fk_cost_alloc_cycle"))
    private FarmingCycle cycle;

    @Column(name = "barn_name", nullable = false, length = 120)
    private String barnName;

    @Column(name = "cycle_code", nullable = false, length = 80)
    private String cycleCode;

    @Column(name = "cost_type", nullable = false, length = 150)
    private String costType;

    @Column(nullable = false)
    private Long amount;

    @Column(name = "source_voucher_code", length = 80)
    private String sourceVoucherCode;

    @Column(name = "allocation_date", nullable = false)
    private LocalDate allocationDate;

    @Column(length = 500)
    private String note;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}

