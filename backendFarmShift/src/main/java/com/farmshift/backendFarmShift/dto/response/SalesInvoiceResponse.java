package com.farmshift.backendFarmShift.dto.response;
import java.time.LocalDate;
public record SalesInvoiceResponse(LocalDate createdDate, Seller seller, Buyer buyer) {
 public record Seller(String name, String taxCode, String address, String phone, String fax, String bankAccount) {}
 public record Buyer(String name, String taxCode, String address, String paymentMethod) {}
}
