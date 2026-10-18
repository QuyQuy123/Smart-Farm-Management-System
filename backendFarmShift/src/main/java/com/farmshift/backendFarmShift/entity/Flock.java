package com.farmshift.backendFarmShift.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** Đàn: một lô vật nuôi được nhập (hoặc tách/chuyển) vào một lứa nuôi. */
@Entity
@Table(name = "flocks")
@Data
public class Flock {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cycle_id", nullable = false)
    private FarmingCycle cycle;
    @Column(nullable = false, length = 150)
    private String name;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private FlockGender gender;
    @Enumerated(EnumType.STRING)
    @Column(name = "source_type", nullable = false, length = 20)
    private FlockSource sourceType;
    /** Nhà cung cấp / nơi nhập, hoặc mô tả chuồng nguồn khi chuyển đàn. */
    @Column(name = "source_note", length = 200)
    private String sourceNote;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_flock_id")
    private Flock sourceFlock;
    /** Chương trình nuôi (giống) của đàn: quyết định cám, vắc-xin, thuốc, nhiệt độ theo ngày tuổi. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "program_id")
    private FarmingProgram program;
    @Column(name = "import_date", nullable = false)
    private LocalDate importDate;
    /** Ngày tuổi của đàn tại ngày nhập. */
    @Column(name = "age_at_import", nullable = false)
    private int ageAtImport;
    @Column(name = "import_quantity", nullable = false)
    private int importQuantity;
    /** Trọng lượng trung bình lúc nhập (kg/con). */
    @Column(name = "import_avg_weight", nullable = false, precision = 8, scale = 3)
    private BigDecimal importAvgWeight;
    /** Giá vốn con giống (đ/con). */
    @Column(name = "unit_price", nullable = false, precision = 14, scale = 2)
    private BigDecimal unitPrice;
    /** Số con còn lại (tồn), cập nhật theo từng biến động. */
    @Column(nullable = false)
    private int quantity;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private FlockStatus status;
    @Column(length = 1000)
    private String note;
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
