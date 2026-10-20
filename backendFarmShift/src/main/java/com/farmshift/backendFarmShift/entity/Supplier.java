package com.farmshift.backendFarmShift.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity @Table(name = "suppliers") @Data
public class Supplier {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, unique = true, length = 40, updatable = false)
    private String code;
    @Column(nullable = false, length = 200)
    private String name;
    @Column(name = "name_key", nullable = false, unique = true, length = 200)
    private String nameKey;
    @Column(nullable = false, length = 100)
    private String representative;
    @Column(nullable = false, length = 20)
    private String phone;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_type_id", nullable = false, foreignKey = @ForeignKey(name = "fk_supplier_product_type"))
    private ProductType productType;

    @Column(length = 100)
    private String email;

    @Column(length = 300)
    private String address;

    @Column(name = "tax_code", length = 50)
    private String taxCode;

    @Column(name = "bank_name", length = 100)
    private String bankName;

    @Column(name = "bank_account", length = 50)
    private String bankAccount;

    @Column(name = "payment_policy", length = 50)
    private String paymentPolicy;

    @Column(name = "opening_debt")
    private Long openingDebt = 0L;

    @Column(length = 1000)
    private String note;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "supplier_tag_mappings",
        joinColumns = @JoinColumn(name = "supplier_id"),
        inverseJoinColumns = @JoinColumn(name = "tag_id")
    )
    private java.util.Set<PurchaseTag> tags = new java.util.HashSet<>();

    @CreationTimestamp @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
    @UpdateTimestamp @Column(name = "updated_at")
    private LocalDateTime updatedAt;
    @PrePersist
    void assignCode() { 
        if (code == null) {
            code = "NCC" + UUID.randomUUID().toString().replace("-", "").toUpperCase(java.util.Locale.ROOT);
        }
        if (openingDebt == null) {
            openingDebt = 0L;
        }
    }
}
