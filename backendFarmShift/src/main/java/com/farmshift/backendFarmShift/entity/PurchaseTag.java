package com.farmshift.backendFarmShift.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "purchase_tags")
@Data
@NoArgsConstructor
public class PurchaseTag {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(name = "name_key", nullable = false, unique = true, length = 100)
    private String nameKey;

    @Column(nullable = false, length = 30)
    private String color;

    @Column(length = 500)
    private String description;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public PurchaseTag(String name, String nameKey, String color, String description) {
        this.name = name;
        this.nameKey = nameKey;
        this.color = color;
        this.description = description;
    }
}
