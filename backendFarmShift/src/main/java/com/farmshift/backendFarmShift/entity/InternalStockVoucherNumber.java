package com.farmshift.backendFarmShift.entity;

import jakarta.persistence.*;
import lombok.Getter;

@Entity
@Table(name = "internal_stock_voucher_numbers")
@Getter
public class InternalStockVoucherNumber {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
}
