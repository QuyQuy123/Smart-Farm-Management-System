package com.farmshift.backendFarmShift.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "measurement_units")
@Data
public class MeasurementUnit {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, length = 30)
    private String code;
    @Column(name = "code_key", nullable = false, unique = true, length = 30)
    private String codeKey;
    @Column(nullable = false, length = 150)
    private String name;
    @Column(name = "name_key", nullable = false, unique = true, length = 150)
    private String nameKey;
    @Column(length = 1000)
    private String description;
    /** Quy cách: một đơn vị này chứa bao nhiêu kg / g / lít / ml / liều (ví dụ Bao 25kg = 25 KG). Null nếu không quy đổi. */
    @Column(name = "content_quantity", precision = 14, scale = 3)
    private BigDecimal contentQuantity;
    @Enumerated(EnumType.STRING)
    @Column(name = "content_unit", length = 10)
    private UsageUnit contentUnit;
    @CreationTimestamp @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
    @UpdateTimestamp @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
