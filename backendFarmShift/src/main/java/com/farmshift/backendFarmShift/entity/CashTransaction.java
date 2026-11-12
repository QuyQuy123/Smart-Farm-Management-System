package com.farmshift.backendFarmShift.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "cash_transactions")
@Data
@NoArgsConstructor
public class CashTransaction {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 30)
    private String code;

    @Column(name = "tx_date", nullable = false)
    private LocalDate txDate;

    @Column(nullable = false, length = 10)
    private String type; // "Thu" | "Chi"

    @Column(nullable = false, length = 150)
    private String category;

    @Column(nullable = false)
    private Long amount;

    @Column(length = 100)
    private String contact;

    @Column(name = "person_name", nullable = false, length = 200)
    private String personName;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "fund_id", nullable = false, foreignKey = @ForeignKey(name = "fk_cash_tx_fund"))
    private CashFund fund;

    @Column(length = 1000)
    private String note;

    @Column(length = 150)
    private String creator;

    @Column(name = "reference_invoice_code", length = 50)
    private String referenceInvoiceCode;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}

