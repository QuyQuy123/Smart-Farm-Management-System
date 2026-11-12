package com.farmshift.backendFarmShift.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "cash_fund_transfers")
@Data
@NoArgsConstructor
public class CashFundTransfer {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 30)
    private String code;

    @Column(name = "transfer_date", nullable = false)
    private LocalDate transferDate;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "from_fund_id", nullable = false, foreignKey = @ForeignKey(name = "fk_cash_transfer_from_fund"))
    private CashFund fromFund;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "to_fund_id", nullable = false, foreignKey = @ForeignKey(name = "fk_cash_transfer_to_fund"))
    private CashFund toFund;

    @Column(nullable = false)
    private Long amount;

    @Column(nullable = false)
    private Long fee = 0L;

    @Column(length = 500)
    private String note;

    @Column(length = 150)
    private String creator;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}

