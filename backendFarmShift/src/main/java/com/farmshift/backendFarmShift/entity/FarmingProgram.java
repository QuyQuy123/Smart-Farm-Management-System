package com.farmshift.backendFarmShift.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/** Chương trình nuôi mẫu: các nội dung (cám, vắc-xin, công việc) theo khoảng ngày tuổi. */
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
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ProgramType type;
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
