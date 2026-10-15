package com.farmshift.backendFarmShift.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.time.LocalDateTime;

/** Shared farm settings for the current single-farm installation. */
@Entity
@Table(name = "farms")
@Data
public class Farm {
    @Id
    private Long id;
    @Column(nullable = false, length = 200)
    private String name;
    @Column(nullable = false, length = 100)
    private String owner;
    @Column(nullable = false, length = 20)
    private String phone;
    @Column(length = 100)
    private String scale;
    @Column(length = 500)
    private String address;
    @Column(length = 200)
    private String type;
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
