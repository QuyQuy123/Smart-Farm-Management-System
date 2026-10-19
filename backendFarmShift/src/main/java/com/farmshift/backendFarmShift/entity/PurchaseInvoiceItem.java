package com.farmshift.backendFarmShift.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "purchase_invoice_items")
@Data
@NoArgsConstructor
public class PurchaseInvoiceItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "invoice_id", nullable = false, foreignKey = @ForeignKey(name = "fk_purchase_item_invoice"))
    private PurchaseInvoice invoice;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_category_id", foreignKey = @ForeignKey(name = "fk_purchase_item_product_category"))
    private ProductCategory productCategory;

    @Column(name = "product_name", nullable = false, length = 200)
    private String productName;

    @Column(nullable = false)
    private Double quantity = 1.0;

    @Column(nullable = false, length = 50)
    private String unit = "Bao";

    @Column(name = "unit_price", nullable = false)
    private Long unitPrice = 0L;

    @Column(name = "vat_rate")
    private Double vatRate = 0.0;

    @Column(nullable = false)
    private Long amount = 0L;

    public PurchaseInvoiceItem(PurchaseInvoice invoice, ProductCategory productCategory, String productName,
                               Double quantity, String unit, Long unitPrice, Double vatRate, Long amount) {
        this.invoice = invoice;
        this.productCategory = productCategory;
        this.productName = productName;
        this.quantity = quantity;
        this.unit = unit;
        this.unitPrice = unitPrice;
        this.vatRate = vatRate != null ? vatRate : 0.0;
        this.amount = amount != null ? amount : Math.round(quantity * unitPrice);
    }
}
