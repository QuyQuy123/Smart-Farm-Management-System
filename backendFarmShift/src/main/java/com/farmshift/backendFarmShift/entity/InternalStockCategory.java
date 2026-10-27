package com.farmshift.backendFarmShift.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.time.LocalDateTime;

@Entity
@Table(
    name = "internal_stock_categories",
    uniqueConstraints = @UniqueConstraint(name = "uq_internal_stock_category_name_key", columnNames = "name_key")
)
@Data
public class InternalStockCategory {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "movement_type", nullable = false, length = 20)
    private String movementType; // IMPORT, EXPORT, TRANSFER

    @Column(nullable = false, length = 150)
    private String name;

    @Column(name = "name_key", nullable = false, length = 150)
    private String nameKey;

    @Column(length = 1000)
    private String description;

    @Column(name = "is_system", nullable = false)
    private boolean isSystem = false;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
