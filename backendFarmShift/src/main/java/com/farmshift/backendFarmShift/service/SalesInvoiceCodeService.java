package com.farmshift.backendFarmShift.service;
import com.farmshift.backendFarmShift.entity.SalesInvoiceNumber;
import com.farmshift.backendFarmShift.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
@Service @RequiredArgsConstructor
public class SalesInvoiceCodeService {
 private final SalesInvoiceNumberRepository numbers;
 private final SalesOrderRepository orders;
 @Transactional
 public String nextCode() {
  String code;
  do { code = "BH" + String.format(java.util.Locale.ROOT, "%05d", numbers.saveAndFlush(new SalesInvoiceNumber()).getId()); }
  while (orders.existsByCode(code));
  return code;
 }
}
