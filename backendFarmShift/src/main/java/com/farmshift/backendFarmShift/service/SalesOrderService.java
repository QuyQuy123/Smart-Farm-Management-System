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
 private final SalesInvoiceCodeService codes;
 @Transactional
 public SalesOrder create(SalesOrderRequest request) {
  var existing = orders.findById(request.id());
  if (existing.isPresent()) return existing.get();
  return save(new SalesOrder(), request);
 }
 @Transactional
 public SalesOrder update(String id, SalesOrderRequest request) {
  if (!id.equals(request.id())) throw new BadRequestException("Mã hóa đơn không khớp.");
  var order = orders.findForUpdate(id).orElseThrow(() -> new com.farmshift.backendFarmShift.exception.ResourceNotFoundException("Không tìm thấy hóa đơn."));
  return save(order, request);
 }
 private SalesOrder save(SalesOrder order, SalesOrderRequest request) {
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
  if (order.getId() != null) {
   var previousBuyer = order.getBuyer();
   if (previousBuyer == null) previousBuyer = customers.findFirstByPhoneAndNameIgnoreCaseOrderByIdAsc(order.getPhone(), order.getCustomer()).orElse(null);
   if (previousBuyer != null) {
    previousBuyer.setTotalBought((previousBuyer.getTotalBought() == null ? BigDecimal.ZERO : previousBuyer.getTotalBought()).subtract(order.getTotalAmount()));
    previousBuyer.setDebt((previousBuyer.getDebt() == null ? BigDecimal.ZERO : previousBuyer.getDebt()).subtract(order.getTotalAmount().subtract(order.getPaidAmount())));
    customers.save(previousBuyer);
   }
  }
  var customer = customers.findFirstByPhoneAndNameIgnoreCaseOrderByIdAsc(request.phone().strip(), request.customer().strip()).orElseGet(CustomerContact::new);
  customer.setName(request.customer().strip()); customer.setPhone(request.phone().strip()); customer.setAddress(request.address().strip());
  if(request.taxCode()!=null && !request.taxCode().isBlank()) customer.setTaxCode(request.taxCode().strip());
  if(request.paymentMethod()!=null && !request.paymentMethod().isBlank()) customer.setPaymentMethod(request.paymentMethod().strip());
  customer.setTotalBought((customer.getTotalBought() == null ? BigDecimal.ZERO : customer.getTotalBought()).add(total));
  customer.setDebt((customer.getDebt() == null ? BigDecimal.ZERO : customer.getDebt()).add(total.subtract(paid)));
  customers.save(customer);
  order.setBuyer(customer);
  if (order.getId() == null) { order.setId(request.id()); order.setCode(codes.nextCode()); }
  order.setDate(request.date()); order.setCustomer(customer.getName()); order.setPhone(customer.getPhone()); order.setAddress(customer.getAddress());
  order.setFlock(request.flock()); order.setQuantity(request.quantity()); order.setTotalWeight(request.totalWeight()); order.setUnitPrice(request.unitPrice());
  order.setTotalAmount(total); order.setPaidAmount(paid); order.setStatus(request.status()); order.setNote(request.note());
  return orders.save(order);
 }
}
