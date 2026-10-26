package com.farmshift.backendFarmShift.config;
import com.farmshift.backendFarmShift.repository.SalesOrderRepository;
import com.farmshift.backendFarmShift.service.SalesInvoiceCodeService;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
@Component @RequiredArgsConstructor
public class SalesInvoiceCodeMigration implements ApplicationRunner {
 private final SalesOrderRepository orders;
 private final SalesInvoiceCodeService codes;
 @Override @Transactional
 public void run(ApplicationArguments args) {
  for (var order : orders.findAll(Sort.by("date", "id"))) {
   if (order.getCode() != null && order.getCode().matches("BH[0-9A-F]{32}")) {
    order.setCode(codes.nextCode()); orders.saveAndFlush(order);
   }
  }
 }
}
