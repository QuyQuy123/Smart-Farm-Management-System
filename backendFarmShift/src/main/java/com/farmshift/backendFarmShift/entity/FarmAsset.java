package com.farmshift.backendFarmShift.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "farm_assets")
@Data
@NoArgsConstructor
public class FarmAsset {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 30)
    private String code;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(nullable = false)
    private Long cost;

    @Column(name = "depreciation_months", nullable = false)
    private Integer depreciationMonths;

    @Column(name = "monthly_depreciation", nullable = false)
    private Long monthlyDepreciation;

    @Column(name = "barn_location", length = 200)
    private String barnLocation;

    @Column(name = "purchase_date")
    private LocalDate purchaseDate;

    @Column(nullable = false, length = 80)
    private String status = "Đang trích khấu hao";

    @Column(length = 500)
    private String note;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}

