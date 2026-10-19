package com.farmshift.backendFarmShift.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Entity
@Table(name = "purchase_invoices")
@Data
@NoArgsConstructor
public class PurchaseInvoice {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 30)
    private String code;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "supplier_id", nullable = false, foreignKey = @ForeignKey(name = "fk_purchase_supplier"))
    private Supplier supplier;

    @Column(name = "invoice_date", nullable = false)
    private LocalDate invoiceDate;

    @Column(name = "discount_amount")
    private Long discountAmount = 0L;

    @Column(name = "other_cost")
    private Long otherCost = 0L;

    @Column(name = "total_amount", nullable = false)
    private Long totalAmount = 0L;

    @Column(name = "paid_amount", nullable = false)
    private Long paidAmount = 0L;

    @Column(name = "payment_status", nullable = false, length = 50)
    private String paymentStatus = "Thanh toán hoàn tất";

    @Column(name = "stock_status", nullable = false, length = 50)
    private String stockStatus = "Đã nhập kho";

    @Column(name = "reference_code", length = 100)
    private String referenceCode;

    @Column(length = 1000)
    private String note;

    @Column(name = "attachment_url", length = 500)
    private String attachmentUrl;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "purchase_invoice_tag_mappings",
        joinColumns = @JoinColumn(name = "invoice_id"),
        inverseJoinColumns = @JoinColumn(name = "tag_id")
    )
    private Set<PurchaseTag> tags = new HashSet<>();

    @OneToMany(mappedBy = "invoice", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<PurchaseInvoiceItem> items = new ArrayList<>();

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public void addItem(PurchaseInvoiceItem item) {
        items.add(item);
        item.setInvoice(this);
    }

    public void removeItem(PurchaseInvoiceItem item) {
        items.remove(item);
        item.setInvoice(null);
    }
}
