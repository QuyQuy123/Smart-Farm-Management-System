package com.farmshift.backendFarmShift.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "inventory_items")
@Data
@NoArgsConstructor
public class InventoryItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_category_id", foreignKey = @ForeignKey(name = "fk_inventory_product_category"))
    private ProductCategory productCategory;

    @Column(name = "product_name", nullable = false, length = 200)
    private String productName;

    @Column(name = "product_name_key", nullable = false, length = 200)
    private String productNameKey;

    @Column(nullable = false, length = 50)
    private String unit;

    @Column(nullable = false)
    private Double stock = 0.0;

    @Column(name = "cost_price")
    private Long costPrice = 0L;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "warehouse_id", foreignKey = @ForeignKey(name = "fk_inventory_warehouse"))
    private WarehouseCategory warehouse;

    @Column(name = "lot_code", length = 100)
    private String lotCode;

    @Column(name = "expiry_date")
    private LocalDate expiryDate;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
