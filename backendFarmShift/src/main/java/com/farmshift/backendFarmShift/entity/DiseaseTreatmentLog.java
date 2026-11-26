package com.farmshift.backendFarmShift.entity;

import com.farmshift.backendFarmShift.service.CycleService;
import jakarta.persistence.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Một lần dùng thuốc trong ngày thuộc một đợt bệnh ({@link CycleDisease}).
 * Liên kết 1-1 với {@link CycleExpense} (category = MEDICINE) để không tính trùng chi phí lứa.
 */
@Entity
@Table(name = "disease_treatment_logs", indexes = {
        @Index(name = "idx_disease_treatments_disease_date", columnList = "disease_id, treatment_date")
})
@Data
public class DiseaseTreatmentLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "disease_id", nullable = false)
    private CycleDisease disease;

    @Column(name = "treatment_date", nullable = false)
    private LocalDate treatmentDate;

    @Column(name = "medicine_name", nullable = false, length = 200)
    private String medicineName;

    @Enumerated(EnumType.STRING)
    @Column(length = 32)
    private AdministrationMethod method;

    @Column(name = "dosage_text", length = 200)
    private String dosageText;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "inventory_item_id")
    private InventoryItem inventoryItem;

    @Column(name = "stock_quantity", precision = 19, scale = 6)
    private BigDecimal stockQuantity;

    @Column(name = "unit_price", precision = 19, scale = 2)
    private BigDecimal unitPrice;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal cost = BigDecimal.ZERO;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "expense_id")
    private CycleExpense expense;

    @ElementCollection
    @CollectionTable(name = "disease_treatment_stock_allocations", joinColumns = @JoinColumn(name = "treatment_log_id"))
    private List<DiseaseTreatmentStockAllocation> stockAllocations = new ArrayList<>();

    @Column(length = 1000)
    private String note;

    @Column(name = "created_by", length = 150)
    private String createdBy;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (this.createdAt == null) this.createdAt = LocalDateTime.now(CycleService.VN_ZONE);
    }
}
