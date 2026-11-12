package com.farmshift.backendFarmShift.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;

/** Phần chi phí (theo loại) đi theo số con tách sang lứa khác: lứa đích dương, lứa gốc âm; cộng vào khoản chi của lứa. */
@Entity
@Table(name = "cycle_carried_expenses", uniqueConstraints = @UniqueConstraint(name = "uk_cycle_carried_expense", columnNames = {"cycle_id", "category"}))
@Data
public class CycleCarriedExpense {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cycle_id", nullable = false)
    private FarmingCycle cycle;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ExpenseCategory category;
    @Column(nullable = false, precision = 19, scale = 3)
    private BigDecimal amount = BigDecimal.ZERO;
}
