package com.farmshift.backendFarmShift.entity;
import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.time.LocalDateTime;
import java.util.UUID;
@Entity @Data
@Table(name="transfer_categories", uniqueConstraints=@UniqueConstraint(name="uq_transfer_category_type_name", columnNames={"slip_type", "name_key"}))
public class TransferCategory {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(nullable=false, unique=true, length=40, updatable=false) private String code;
    @Column(name="slip_type", nullable=false, length=150) private String type;
    @Column(nullable=false, length=150) private String name;
    @Column(name="name_key", nullable=false, length=150) private String nameKey;
    @Column(length=1000) private String description;
    @CreationTimestamp @Column(name="created_at", updatable=false) private LocalDateTime createdAt;
    @UpdateTimestamp @Column(name="updated_at") private LocalDateTime updatedAt;
    @PrePersist void assignCode() { code="DM"+UUID.randomUUID().toString().replace("-", "").toUpperCase(java.util.Locale.ROOT); }
}
