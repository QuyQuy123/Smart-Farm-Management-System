package com.farmshift.backendFarmShift.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "inventory_items", indexes = @Index(name = "idx_inventory_warehouse_product", columnList = "warehouse_id,product_id"))
@Data
public class InventoryItem {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(nullable = false, unique = true, length = 40, updatable = false) private String code;
    // Receipt identity prevents reusing a depleted purchase lot for a later invoice.
    @Column(name = "purchase_invoice_item_id", unique = true)
    private Long purchaseInvoiceItemId;
    @Column(name = "image_url", columnDefinition = "TEXT") private String imageUrl;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "warehouse_id", nullable = false) private WarehouseCategory warehouse;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false) private ProductCategory product;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "brand_id") private Brand brand;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "unit_id", foreignKey = @ForeignKey(name = "fk_inventory_unit")) private MeasurementUnit unit;
    @Column(nullable = false, precision = 19, scale = 2) private BigDecimal price;
    @Column(nullable = false, precision = 19, scale = 3) private BigDecimal stock = BigDecimal.ZERO;
    @CreationTimestamp @Column(name = "created_at", updatable = false) private LocalDateTime createdAt;
    @UpdateTimestamp @Column(name = "updated_at") private LocalDateTime updatedAt;
    @PrePersist void assignCode() { code = "SP" + UUID.randomUUID().toString().replace("-", "").toUpperCase(java.util.Locale.ROOT); }
}
