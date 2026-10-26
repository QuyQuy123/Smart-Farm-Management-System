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
 @Column(columnDefinition="TEXT") private String note;
}
