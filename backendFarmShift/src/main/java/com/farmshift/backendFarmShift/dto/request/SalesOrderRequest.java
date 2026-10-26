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
 @Size(max=5000) String note) {}
