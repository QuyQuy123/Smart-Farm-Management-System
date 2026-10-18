package com.farmshift.backendFarmShift.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** Một nội dung của chương trình nuôi, áp dụng từ ngày tuổi dayFrom đến dayTo. */
@Entity
@Table(name = "farming_program_steps")
@Data
public class FarmingProgramStep {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "program_id", nullable = false)
    @lombok.ToString.Exclude
    @lombok.EqualsAndHashCode.Exclude
    private FarmingProgram program;
    @Column(nullable = false, length = 200)
    private String name;
    @Column(name = "day_from", nullable = false)
    private int dayFrom;
    @Column(name = "day_to", nullable = false)
    private int dayTo;
    /** Định mức (ví dụ 85 g/con/ngày, 1 liều/con), có thể để trống. */
    @Column(precision = 14, scale = 3)
    private BigDecimal quantity;
    @Column(length = 50)
    private String unit;
    @Column(length = 1000)
    private String note;
}
