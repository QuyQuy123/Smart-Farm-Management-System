package com.farmshift.backendFarmShift.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "cash_transaction_categories")
@Data
@NoArgsConstructor
public class CashTransactionCategory {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(name = "name_key", nullable = false, unique = true, length = 180)
    private String nameKey;

    @Column(nullable = false, length = 10)
    private String type; // "Thu" | "Chi"

    @Column(name = "cost_group", nullable = false, length = 120)
    private String costGroup;

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

