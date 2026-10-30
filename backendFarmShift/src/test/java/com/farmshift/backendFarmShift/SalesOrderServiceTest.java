package com.farmshift.backendFarmShift;
import com.farmshift.backendFarmShift.service.SalesOrderService;
import com.farmshift.backendFarmShift.entity.*;
import com.farmshift.backendFarmShift.repository.*;
import com.farmshift.backendFarmShift.dto.request.SalesOrderRequest;
import com.farmshift.backendFarmShift.exception.BadRequestException;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class SalesOrderServiceTest {
 private SalesOrderRequest request(String status, String paid) {
  return new SalesOrderRequest("sale-id", LocalDate.now(), "Buyer", "0912345678", "Address", "Area - Barn - Cycle", 10, new BigDecimal("20"), new BigDecimal("50000"), status, paid == null ? null : new BigDecimal(paid), "note", "0123456789", "Chuyển khoản");
 }
 @Test void partialPaymentAccumulatesExistingCustomerTotals() {
  var orders = mock(SalesOrderRepository.class); var customers = mock(CustomerContactRepository.class);
  when(orders.findById("sale-id")).thenReturn(Optional.empty());
  when(orders.save(any())).thenAnswer(call -> call.getArgument(0));
  var customer = new CustomerContact(); customer.setTotalBought(new BigDecimal("100000")); customer.setDebt(new BigDecimal("50000"));
  when(customers.findFirstByPhoneAndNameIgnoreCaseOrderByIdAsc("0912345678", "Buyer")).thenReturn(Optional.of(customer));
  var order = new SalesOrderService(orders, customers, mock(com.farmshift.backendFarmShift.service.SalesInvoiceCodeService.class), mock(com.farmshift.backendFarmShift.service.ocr.WeightSlipStorage.class)).create(request("PARTIAL", "300000"));
  assertEquals(0, new BigDecimal("1000000").compareTo(order.getTotalAmount()));
  assertEquals(0, new BigDecimal("300000").compareTo(order.getPaidAmount()));
  assertEquals(0, new BigDecimal("1100000").compareTo(customer.getTotalBought()));
  assertEquals(0, new BigDecimal("750000").compareTo(customer.getDebt()));
  assertEquals("0123456789", customer.getTaxCode());
  assertEquals("Chuyển khoản", customer.getPaymentMethod());
  assertSame(customer, order.getBuyer());
  assertEquals("Address", customer.getAddress()); verify(customers).save(customer);
 }
 @Test void paidAndDebtCreateCustomersWithCorrectBalances() {
  for (String status : new String[]{"PAID", "DEBT"}) {
   var orders = mock(SalesOrderRepository.class); var customers = mock(CustomerContactRepository.class);
   when(orders.findById(any())).thenReturn(Optional.empty());
   when(customers.findFirstByPhoneAndNameIgnoreCaseOrderByIdAsc(any(), any())).thenReturn(Optional.empty());
   when(orders.save(any())).thenAnswer(call -> call.getArgument(0));
   var service = new SalesOrderService(orders, customers, mock(com.farmshift.backendFarmShift.service.SalesInvoiceCodeService.class), mock(com.farmshift.backendFarmShift.service.ocr.WeightSlipStorage.class));
   var order = service.create(request(status, null));
   assertEquals(0, (status.equals("PAID") ? new BigDecimal("1000000") : BigDecimal.ZERO).compareTo(order.getPaidAmount()));
   verify(customers).save(argThat(c -> c.getDebt().compareTo(status.equals("PAID") ? BigDecimal.ZERO : new BigDecimal("1000000")) == 0));
  }
 }
 @Test void invalidPartialPaymentDoesNotWriteAnything() {
  var orders = mock(SalesOrderRepository.class); var customers = mock(CustomerContactRepository.class);
  when(orders.findById(any())).thenReturn(Optional.empty());
  var service = new SalesOrderService(orders, customers, mock(com.farmshift.backendFarmShift.service.SalesInvoiceCodeService.class), mock(com.farmshift.backendFarmShift.service.ocr.WeightSlipStorage.class));
  for (String amount : new String[]{"0", "-1", "1000000", "1000001"}) assertThrows(BadRequestException.class, () -> service.create(request("PARTIAL", amount)));
  verifyNoInteractions(customers); verify(orders, never()).save(any());
 }
 @Test void retryDoesNotAccumulateTwice() {
  var orders = mock(SalesOrderRepository.class); var customers = mock(CustomerContactRepository.class);
  var existing = new SalesOrder(); when(orders.findById("sale-id")).thenReturn(Optional.of(existing));
  assertSame(existing, new SalesOrderService(orders, customers, mock(com.farmshift.backendFarmShift.service.SalesInvoiceCodeService.class), mock(com.farmshift.backendFarmShift.service.ocr.WeightSlipStorage.class)).create(request("PAID", null)));
  verifyNoInteractions(customers);
 }
}
