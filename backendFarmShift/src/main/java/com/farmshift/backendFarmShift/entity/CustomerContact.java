package com.farmshift.backendFarmShift.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity @Table(name = "customer_contacts") @Data
public class CustomerContact {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, unique = true, length = 40, updatable = false)
    private String code;
    @Column(nullable = false, length = 200)
    private String name;
    @Column(nullable = false, length = 20)
    private String phone;
    private String address;
    @Column(name="tax_code", length=50) private String taxCode;
    @Column(name="payment_method", length=100) private String paymentMethod;

    @Column(name = "total_bought", precision = 19, scale = 2)
    private java.math.BigDecimal totalBought;

    @Column(precision = 19, scale = 2)
    private java.math.BigDecimal debt;

    @Column(columnDefinition = "TEXT")
    private String note;

    @CreationTimestamp @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
    @UpdateTimestamp @Column(name = "updated_at")
    private LocalDateTime updatedAt;
    @PrePersist void assignCode() { code = "KH" + UUID.randomUUID().toString().replace("-", "").toUpperCase(java.util.Locale.ROOT); }
}
