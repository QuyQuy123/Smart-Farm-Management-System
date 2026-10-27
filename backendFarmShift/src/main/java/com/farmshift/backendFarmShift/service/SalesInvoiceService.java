package com.farmshift.backendFarmShift.service;
import com.farmshift.backendFarmShift.dto.response.SalesInvoiceResponse;
import com.farmshift.backendFarmShift.repository.*;
import com.farmshift.backendFarmShift.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.beans.factory.annotation.Value;
@Service @RequiredArgsConstructor
public class SalesInvoiceService {
 private final SalesOrderRepository orders;
 private final CustomerContactRepository customers;
 @Value("${sales.invoice.seller.name:}") private String name;
 @Value("${sales.invoice.seller.tax-code:}") private String taxCode;
 @Value("${sales.invoice.seller.address:}") private String address;
 @Value("${sales.invoice.seller.phone:}") private String phone;
 @Value("${sales.invoice.seller.fax:}") private String fax;
 @Value("${sales.invoice.seller.bank-account:}") private String bankAccount;
 @Transactional(readOnly=true)
 public SalesInvoiceResponse get(String id) {
  var order=orders.findById(id).orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn bán hàng."));
  var buyer=order.getBuyer();
  if(buyer==null) buyer=customers.findFirstByPhoneAndNameIgnoreCaseOrderByIdAsc(order.getPhone(),order.getCustomer()).orElse(null);
  return new SalesInvoiceResponse(order.getCreatedAt()==null ? order.getDate() : order.getCreatedAt().toLocalDate(),
   new SalesInvoiceResponse.Seller(name,taxCode,address,phone,fax,bankAccount),
   buyer==null ? null : new SalesInvoiceResponse.Buyer(buyer.getName(),buyer.getTaxCode(),buyer.getAddress(),buyer.getPaymentMethod()));
 }
}
