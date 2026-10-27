package com.farmshift.backendFarmShift.dto.response;
import java.time.LocalDate;
import java.math.BigDecimal;
public record SalesInvoiceResponse(LocalDate createdDate, Seller seller, Buyer buyer, Order order) {
 public record Seller(String name, String taxCode, String address, String phone, String fax, String bankAccount) {}
 public record Buyer(String name, String taxCode, String address, String paymentMethod) {}
 public record Order(String code, int quantity, BigDecimal totalWeight, BigDecimal unitPrice, BigDecimal totalAmount, BigDecimal paidAmount, BigDecimal debtAmount, String note) {}
}
