package com.farmshift.backendFarmShift;
import com.farmshift.backendFarmShift.service.SalesOrderService;
import com.farmshift.backendFarmShift.entity.*;
import com.farmshift.backendFarmShift.repository.*;
import com.farmshift.backendFarmShift.dto.request.SalesOrderRequest;
import com.farmshift.backendFarmShift.exception.BadRequestException;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
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
 @Test void deductsChickensFromBarnAndFlockAndRecordsHarvestMovement() {
  var orders = mock(SalesOrderRepository.class);
  var customers = mock(CustomerContactRepository.class);
  var cycles = mock(FarmingCycleRepository.class);
  var barns = mock(BarnRepository.class);
  var flocks = mock(FlockRepository.class);
  var movements = mock(FlockMovementRepository.class);
  var codes = mock(com.farmshift.backendFarmShift.service.SalesInvoiceCodeService.class);
  var storage = mock(com.farmshift.backendFarmShift.service.ocr.WeightSlipStorage.class);

  when(orders.findById("sale-id")).thenReturn(Optional.empty());
  when(orders.save(any())).thenAnswer(call -> call.getArgument(0));
  when(customers.findFirstByPhoneAndNameIgnoreCaseOrderByIdAsc(any(), any())).thenReturn(Optional.empty());
  when(codes.nextCode()).thenReturn("DH000001");
  when(movements.save(any())).thenAnswer(call -> call.getArgument(0));

  Barn barn = new Barn();
  barn.setId(10L);
  barn.setName("Chuồng A1");
  barn.setCurrentQuantity(1000);

  FarmingCycle cycle = new FarmingCycle();
  cycle.setId(5L);
  cycle.setBarn(barn);

  Flock flock = new Flock();
  flock.setId(20L);
  flock.setCycle(cycle);
  flock.setQuantity(1000);
  flock.setStatus(FlockStatus.ACTIVE);

  when(cycles.findById(5L)).thenReturn(Optional.of(cycle));
  when(flocks.findAllByCycleIdOrderByImportDateAscIdAsc(5L)).thenReturn(List.of(flock));

  var service = new SalesOrderService(orders, customers, codes, storage, cycles, barns, flocks, movements);
  var req = new SalesOrderRequest("sale-id", LocalDate.now(), "Buyer", "0912345678", "Address", "Khu gà mía - Chuồng A1 - L000005",
          200, new BigDecimal("400"), new BigDecimal("75000"), "PAID", null, "Giao gà sáng sớm", "0123456789", "Tiền mặt", 5L);

  var order = service.create(req);

  assertNotNull(order);
  assertEquals(800, barn.getCurrentQuantity());
  assertEquals(800, flock.getQuantity());
  verify(barns).save(barn);
  verify(flocks).save(flock);
  verify(movements).save(argThat(m ->
          m.getType() == FlockMovementType.HARVEST
                  && m.getQuantity() == 200
                  && m.getWeightKg().compareTo(new BigDecimal("400")) == 0
                  && m.getUnitPrice().compareTo(new BigDecimal("75000")) == 0
  ));
  assertNotNull(order.getHarvestMovement());
  assertEquals(cycle, order.getCycle());
 }
}
