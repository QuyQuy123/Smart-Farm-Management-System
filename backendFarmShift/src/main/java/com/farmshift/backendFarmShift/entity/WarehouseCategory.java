package com.farmshift.backendFarmShift.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "warehouse_categories")
@Data
public class WarehouseCategory {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, length = 150)
    private String name;
    @Column(name = "name_key", nullable = false, unique = true, length = 150)
    private String nameKey;
    @Column(length = 1000)
    private String description;
    @ManyToMany
    @JoinTable(name = "warehouse_workers", joinColumns = @JoinColumn(name = "warehouse_id"),
            inverseJoinColumns = @JoinColumn(name = "account_id"),
            uniqueConstraints = @UniqueConstraint(name = "uk_warehouse_workers", columnNames = {"warehouse_id", "account_id"}))
    private List<Account> workers = new ArrayList<>();
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
