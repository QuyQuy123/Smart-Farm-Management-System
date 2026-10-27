package com.farmshift.backendFarmShift.dto.request;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
public record SalesOrderRequest(
 @NotBlank @Size(max=80) String id,
 @NotNull LocalDate date,
 @NotBlank @Size(max=200) String customer,
 @NotBlank @Pattern(regexp="[0-9]{10,11}") String phone,
 @NotBlank @Size(max=255) String address,
 @NotBlank @Size(max=255) String flock,
 @Min(1) int quantity,
 @NotNull @DecimalMin("0.001") BigDecimal totalWeight,
 @NotNull @DecimalMin("0.01") BigDecimal unitPrice,
 @NotBlank String status,
 BigDecimal paidAmount,
 @Size(max=5000) String note,
 @Size(max=50) String taxCode,
 @Size(max=100) String paymentMethod) {
 public SalesOrderRequest(String id, LocalDate date, String customer, String phone, String address, String flock,
                          int quantity, BigDecimal totalWeight, BigDecimal unitPrice, String status, BigDecimal paidAmount, String note) {
  this(id,date,customer,phone,address,flock,quantity,totalWeight,unitPrice,status,paidAmount,note,null,null);
 }
}
