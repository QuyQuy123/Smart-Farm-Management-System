package com.farmshift.backendFarmShift.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Chương trình nuôi theo giống (ví dụ Gà ta thả vườn 105 ngày): cám định mức, lịch vắc-xin, thuốc trộn,
 * nhiệt độ chuồng và công việc chăm sóc theo ngày tuổi. Đàn được gắn với một chương trình khi nhập đàn.
 */
@Entity
@Table(name = "farming_programs")
@Data
public class FarmingProgram {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, length = 150)
    private String name;
    @Column(name = "name_key", nullable = false, unique = true, length = 150)
    private String nameKey;
    /** Giống gà áp dụng, ví dụ Gà ta, Gà Mía, Gà J-Dabaco. */
    @Column(nullable = false, length = 100)
    private String breed;
    /** Thời gian nuôi dự kiến (ngày tuổi xuất chuồng). */
    @Column(name = "duration_days", nullable = false)
    private int durationDays;
    @Column(name = "target_weight_min", precision = 5, scale = 2)
    private BigDecimal targetWeightMin;
    @Column(name = "target_weight_max", precision = 5, scale = 2)
    private BigDecimal targetWeightMax;
    @Column(length = 1000)
    private String description;
    @OneToMany(mappedBy = "program", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("dayFrom ASC, id ASC")
    @lombok.ToString.Exclude
    @lombok.EqualsAndHashCode.Exclude
    private List<FarmingProgramStep> steps = new ArrayList<>();
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
