package com.farmshift.backendFarmShift.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** Khoản chi bổ sung của lứa: điện, nước, công nhân, thuốc, chi phí khác. */
@Entity
@Table(name = "cycle_expenses")
@Data
public class CycleExpense {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cycle_id", nullable = false)
    private FarmingCycle cycle;
    @Column(name = "expense_date", nullable = false)
    private LocalDate expenseDate;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ExpenseCategory category;
    @Column(nullable = false, precision = 16, scale = 2)
    private BigDecimal amount;
    @Column(length = 1000)
    private String note;
    @Column(name = "created_by", length = 150)
    private String createdBy;
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
