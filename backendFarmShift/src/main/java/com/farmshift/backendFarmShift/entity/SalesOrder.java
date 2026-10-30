package com.farmshift.backendFarmShift.entity;
import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;
@Entity @Table(name="sales_orders") @Data
public class SalesOrder {
 @Id private String id;
 @Column(nullable=false, unique=true) private String code;
 private LocalDate date;
 private String customer;
 private String phone;
 private String address;
 private String flock;
 private int quantity;
 private BigDecimal totalWeight;
 private BigDecimal unitPrice;
 private BigDecimal totalAmount;
 private BigDecimal paidAmount;
 private String status;
 @Column(name="weight_slip_url", length=500) private String weightSlipUrl;
 @Column(columnDefinition="TEXT") private String note;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="customer_id") @com.fasterxml.jackson.annotation.JsonIgnore
 private CustomerContact buyer;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="cycle_id") @com.fasterxml.jackson.annotation.JsonIgnore
 private FarmingCycle cycle;
 @OneToOne(fetch=FetchType.LAZY) @JoinColumn(name="movement_id") @com.fasterxml.jackson.annotation.JsonIgnore
 private FlockMovement harvestMovement;
 @Column(name="created_at", updatable=false) private java.time.LocalDateTime createdAt;
 @PrePersist void recordCreationTime() { if(createdAt==null) createdAt=java.time.LocalDateTime.now(java.time.ZoneId.of("Asia/Bangkok")); }
 public Long getCycleId() { return cycle != null ? cycle.getId() : null; }
}
