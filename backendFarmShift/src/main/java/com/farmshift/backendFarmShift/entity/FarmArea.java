package com.farmshift.backendFarmShift.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

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
    @ManyToMany
    @JoinTable(name = "farm_area_workers", joinColumns = @JoinColumn(name = "area_id"),
            inverseJoinColumns = @JoinColumn(name = "account_id"),
            uniqueConstraints = @UniqueConstraint(name = "uk_farm_area_workers", columnNames = {"area_id", "account_id"}))
    private List<Account> workers = new ArrayList<>();
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
