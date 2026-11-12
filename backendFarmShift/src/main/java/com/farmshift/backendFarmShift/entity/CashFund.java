package com.farmshift.backendFarmShift.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "cash_funds")
@Data
@NoArgsConstructor
public class CashFund {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 150)
    private String name;

    @Column(name = "account_no", length = 80)
    private String accountNo;

    @Column(nullable = false, length = 150)
    private String bank;

    @Column(name = "fund_type", nullable = false, length = 30)
    private String fundType = "BANK";

    @Column(nullable = false)
    private Long balance = 0L;

    @Column(length = 500)
    private String note;

    @Column(nullable = false)
    private Boolean active = true;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}

