package com.farmshift.backendFarmShift.service;
import com.farmshift.backendFarmShift.entity.*;
import com.farmshift.backendFarmShift.repository.*;
import com.farmshift.backendFarmShift.dto.request.SalesOrderRequest;
import com.farmshift.backendFarmShift.exception.BadRequestException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
@Service @RequiredArgsConstructor
public class SalesOrderService {
 private final SalesOrderRepository orders;
 private final CustomerContactRepository customers;
 @Transactional
 public SalesOrder create(SalesOrderRequest request) {
  var existing = orders.findById(request.id());
  if (existing.isPresent()) return existing.get();
  BigDecimal total = request.totalWeight().multiply(request.unitPrice()).setScale(2, java.math.RoundingMode.HALF_UP);
  BigDecimal paid = switch (request.status()) {
   case "PAID" -> total;
   case "DEBT" -> BigDecimal.ZERO;
   case "PARTIAL" -> {
    if (request.paidAmount() == null || request.paidAmount().signum() <= 0 || request.paidAmount().compareTo(total) >= 0)
     throw new BadRequestException("Số tiền đã trả phải lớn hơn 0 và nhỏ hơn tổng doanh thu.");
    yield request.paidAmount().setScale(2, java.math.RoundingMode.HALF_UP);
   }
   default -> throw new BadRequestException("Trạng thái thanh toán không hợp lệ.");
  };
  var customer = customers.findFirstByPhoneOrderByIdAsc(request.phone().strip()).orElseGet(CustomerContact::new);
  customer.setName(request.customer().strip()); customer.setPhone(request.phone().strip()); customer.setAddress(request.address().strip());
  customer.setTotalBought((customer.getTotalBought() == null ? BigDecimal.ZERO : customer.getTotalBought()).add(total));
  customer.setDebt((customer.getDebt() == null ? BigDecimal.ZERO : customer.getDebt()).add(total.subtract(paid)));
  customers.save(customer);
  var order = new SalesOrder();
  order.setId(request.id()); order.setCode("BH" + java.util.UUID.randomUUID().toString().replace("-", "").toUpperCase(java.util.Locale.ROOT));
  order.setDate(request.date()); order.setCustomer(customer.getName()); order.setPhone(customer.getPhone()); order.setAddress(customer.getAddress());
  order.setFlock(request.flock()); order.setQuantity(request.quantity()); order.setTotalWeight(request.totalWeight()); order.setUnitPrice(request.unitPrice());
  order.setTotalAmount(total); order.setPaidAmount(paid); order.setStatus(request.status()); order.setNote(request.note());
  return orders.save(order);
 }
}
