package com.farmshift.backendFarmShift.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "barns", uniqueConstraints = @UniqueConstraint(name = "uk_barns_area_name", columnNames = {"area_id", "name_key"}))
@Data
public class Barn {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "area_id", nullable = false)
    private FarmArea area;
    @Column(nullable = false, length = 100)
    private String name;
    @Column(name = "name_key", nullable = false, length = 100)
    private String nameKey;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private BarnPurpose purpose;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private BarnStatus status;
    @Column(nullable = false)
    private int capacity;
    @Column(name = "current_quantity", nullable = false)
    private int currentQuantity;
    @Column(name = "target_weight", precision = 5, scale = 2)
    private BigDecimal targetWeight;
    @Column(length = 1000)
    private String description;
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
