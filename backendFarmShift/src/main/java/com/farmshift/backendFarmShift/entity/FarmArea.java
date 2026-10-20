package com.farmshift.backendFarmShift.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.time.LocalDateTime;

@Entity
@Table(name = "farm_areas")
@Data
public class FarmArea {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, length = 150)
    private String name;
    @Column(name = "name_key", nullable = false, unique = true, length = 150)
    private String nameKey;
    /** Chỉ số môi trường cần theo dõi, lưu các mã ngăn cách bởi dấu phẩy. */
    @Column(name = "environment_metrics", length = 200)
    private String environmentMetrics;
    /** Chỉ số vật nuôi cần theo dõi, lưu các mã ngăn cách bởi dấu phẩy. */
    @Column(name = "animal_metrics", length = 200)
    private String animalMetrics;
    @Column(length = 1000)
    private String description;
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
