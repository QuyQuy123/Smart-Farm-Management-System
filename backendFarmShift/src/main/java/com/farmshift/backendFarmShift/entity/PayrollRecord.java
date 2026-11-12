package com.farmshift.backendFarmShift.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "payroll_records")
@Data
@NoArgsConstructor
public class PayrollRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 30)
    private String code;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "account_id", foreignKey = @ForeignKey(name = "fk_payroll_account"))
    private Account account;

    @Column(name = "employee_name", nullable = false, length = 150)
    private String employeeName;

    @Column(name = "pay_period", nullable = false, length = 20)
    private String payPeriod;

    @Column(name = "work_days", nullable = false)
    private Integer workDays = 0;

    @Column(name = "daily_rate", nullable = false)
    private Long dailyRate = 0L;

    @Column(nullable = false)
    private Long bonus = 0L;

    @Column(nullable = false)
    private Long advance = 0L;

    @Column(name = "total_amount", nullable = false)
    private Long totalAmount = 0L;

    @Column(name = "paid_amount", nullable = false)
    private Long paidAmount = 0L;

    @Column(name = "remaining_amount", nullable = false)
    private Long remainingAmount = 0L;

    @Column(nullable = false, length = 50)
    private String status = "Còn nợ lương";

    @Column(length = 500)
    private String note;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}

