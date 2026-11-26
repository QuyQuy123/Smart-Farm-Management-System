package com.farmshift.backendFarmShift.entity;

import com.farmshift.backendFarmShift.service.CycleService;
import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Một đợt bệnh kéo dài nhiều ngày trong lứa nuôi (sổ bệnh án).
 * Mỗi đợt bệnh có thể có nhiều nhật ký dùng thuốc theo từng ngày ({@link DiseaseTreatmentLog}).
 */
@Entity
@Table(name = "cycle_diseases", indexes = {
        @Index(name = "idx_cycle_diseases_cycle_status", columnList = "cycle_id, status")
})
@Data
public class CycleDisease {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cycle_id", nullable = false)
    private FarmingCycle cycle;

    /** NULL nghĩa là áp dụng chung cho cả lứa trong chuồng. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "flock_id")
    private Flock flock;

    @Column(name = "disease_name", nullable = false, length = 200)
    private String diseaseName;

    @Column(length = 1000)
    private String symptoms;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DiseaseStatus status = DiseaseStatus.ACTIVE;

    @Column(name = "affected_quantity")
    private Integer affectedQuantity;

    @Column(length = 1000)
    private String note;

    @Column(name = "created_by", length = 150)
    private String createdBy;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        LocalDateTime now = LocalDateTime.now(CycleService.VN_ZONE);
        if (this.createdAt == null) this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = LocalDateTime.now(CycleService.VN_ZONE);
    }
}
