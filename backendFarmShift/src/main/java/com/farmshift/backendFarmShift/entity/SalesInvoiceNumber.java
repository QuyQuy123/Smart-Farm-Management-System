package com.farmshift.backendFarmShift.entity;
import jakarta.persistence.*;
import lombok.Getter;
@Entity @Table(name="sales_invoice_numbers") @Getter
public class SalesInvoiceNumber {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
}
