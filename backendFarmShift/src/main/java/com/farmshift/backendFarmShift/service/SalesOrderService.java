package com.farmshift.backendFarmShift.service;
import com.farmshift.backendFarmShift.entity.*;
import com.farmshift.backendFarmShift.repository.*;
import com.farmshift.backendFarmShift.dto.request.SalesOrderRequest;
import com.farmshift.backendFarmShift.exception.BadRequestException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;

@Service
public class SalesOrderService {
 private final SalesOrderRepository orders;
 private final CustomerContactRepository customers;
 private final SalesInvoiceCodeService codes;
 private final com.farmshift.backendFarmShift.service.ocr.WeightSlipStorage weightSlipStorage;
 private final FarmingCycleRepository cycles;
 private final BarnRepository barns;
 private final FlockRepository flocks;
 private final FlockMovementRepository movements;

 @Autowired
 public SalesOrderService(SalesOrderRepository orders, CustomerContactRepository customers,
                          SalesInvoiceCodeService codes,
                          com.farmshift.backendFarmShift.service.ocr.WeightSlipStorage weightSlipStorage,
                          FarmingCycleRepository cycles, BarnRepository barns,
                          FlockRepository flocks, FlockMovementRepository movements) {
  this.orders = orders;
  this.customers = customers;
  this.codes = codes;
  this.weightSlipStorage = weightSlipStorage;
  this.cycles = cycles;
  this.barns = barns;
  this.flocks = flocks;
  this.movements = movements;
 }

 public SalesOrderService(SalesOrderRepository orders, CustomerContactRepository customers,
                          SalesInvoiceCodeService codes,
                          com.farmshift.backendFarmShift.service.ocr.WeightSlipStorage weightSlipStorage) {
  this(orders, customers, codes, weightSlipStorage, null, null, null, null);
 }

 @Transactional
 public SalesOrder createWithWeightSlip(SalesOrderRequest request, org.springframework.web.multipart.MultipartFile file) {
  var existing = orders.findById(request.id());
  if (existing.isPresent()) {
   if (existing.get().getWeightSlipUrl() == null) throw new BadRequestException("Mã đơn đã tồn tại. Vui lòng tạo đơn mới.");
   return existing.get();
  }
  weightSlipStorage.validate(file);
  var order = create(request);
  String url = weightSlipStorage.save(file);
  org.springframework.transaction.support.TransactionSynchronizationManager.registerSynchronization(new org.springframework.transaction.support.TransactionSynchronization() {
   @Override public void afterCompletion(int status) {
    if (status != STATUS_COMMITTED) weightSlipStorage.delete(url);
   }
  });
  order.setWeightSlipUrl(url);
  return orders.save(order);
 }

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
  BigDecimal total = request.totalWeight().multiply(request.unitPrice()).setScale(2, RoundingMode.HALF_UP);
  BigDecimal paid = switch (request.status()) {
   case "PAID" -> total;
   case "DEBT" -> BigDecimal.ZERO;
   case "PARTIAL" -> {
    if (request.paidAmount() == null || request.paidAmount().signum() <= 0 || request.paidAmount().compareTo(total) >= 0)
     throw new BadRequestException("Số tiền đã trả phải lớn hơn 0 và nhỏ hơn tổng doanh thu.");
    yield request.paidAmount().setScale(2, RoundingMode.HALF_UP);
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
   revertPreviousHarvest(order);
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

  FarmingCycle cycle = resolveCycle(request);
  if (cycle != null) {
   applyHarvest(order, request, cycle);
  }

  return orders.save(order);
 }

 private void revertPreviousHarvest(SalesOrder order) {
  FlockMovement oldMovement = order.getHarvestMovement();
  if (oldMovement == null) return;
  int oldQty = oldMovement.getQuantity();
  Flock oldFlock = oldMovement.getFlock();
  if (oldFlock != null) {
   oldFlock.setQuantity(oldFlock.getQuantity() + oldQty);
   if (oldFlock.getStatus() == FlockStatus.ARCHIVED && oldFlock.getQuantity() > 0) {
    oldFlock.setStatus(FlockStatus.ACTIVE);
   }
   if (flocks != null) flocks.save(oldFlock);
   Barn oldBarn = oldFlock.getCycle() != null ? oldFlock.getCycle().getBarn() : null;
   if (oldBarn != null && barns != null) {
    oldBarn.setCurrentQuantity(oldBarn.getCurrentQuantity() + oldQty);
    barns.save(oldBarn);
   }
  }
 }

 private void applyHarvest(SalesOrder order, SalesOrderRequest request, FarmingCycle cycle) {
  if (cycle == null || flocks == null || movements == null) return;
  Barn barn = cycle.getBarn();
  List<Flock> cycleFlocks = flocks.findAllByCycleIdOrderByImportDateAscIdAsc(cycle.getId());
  Flock targetFlock = cycleFlocks.stream()
    .filter(f -> f.getStatus() == FlockStatus.ACTIVE && f.getQuantity() > 0)
    .findFirst()
    .or(() -> cycleFlocks.stream().findFirst())
    .orElseGet(() -> {
     Flock f = new Flock();
     f.setCycle(cycle);
     f.setName("Đàn " + (barn != null ? barn.getName() : "xuất bán"));
     f.setGender(FlockGender.MIXED);
     f.setSourceType(FlockSource.PURCHASE);
     f.setSourceNote("Tạo từ đơn bán");
     f.setImportDate(order.getDate() != null ? order.getDate() : LocalDate.now());
     f.setAgeAtImport(1);
     int initialQty = barn != null ? Math.max(barn.getCurrentQuantity(), order.getQuantity()) : order.getQuantity();
     f.setImportQuantity(initialQty);
     f.setImportAvgWeight(order.getQuantity() > 0 && order.getTotalWeight() != null
       ? order.getTotalWeight().divide(BigDecimal.valueOf(order.getQuantity()), 3, RoundingMode.HALF_UP)
       : BigDecimal.ONE);
     f.setUnitPrice(BigDecimal.ZERO);
     f.setQuantity(initialQty);
     f.setStatus(FlockStatus.ACTIVE);
     return flocks.save(f);
    });

  int deductQty = order.getQuantity();
  targetFlock.setQuantity(Math.max(0, targetFlock.getQuantity() - deductQty));
  if (targetFlock.getQuantity() == 0) {
   targetFlock.setStatus(FlockStatus.ARCHIVED);
  }
  flocks.save(targetFlock);

  if (barn != null && barns != null) {
   barn.setCurrentQuantity(Math.max(0, barn.getCurrentQuantity() - deductQty));
   barns.save(barn);
  }

  FlockMovement movement = order.getHarvestMovement();
  if (movement == null) {
   movement = new FlockMovement();
  }
  movement.setFlock(targetFlock);
  movement.setType(FlockMovementType.HARVEST);
  movement.setMovementDate(order.getDate() != null ? order.getDate() : LocalDate.now());
  movement.setQuantity(deductQty);
  movement.setWeightKg(order.getTotalWeight());
  movement.setUnitPrice(order.getUnitPrice());
  movement.setNote("Đơn bán " + (order.getCode() != null ? order.getCode() : "")
    + (order.getNote() != null && !order.getNote().isBlank() ? " - " + order.getNote().strip() : ""));
  movement.setCreatedBy("Bán hàng");
  movement = movements.save(movement);

  order.setHarvestMovement(movement);
  order.setCycle(cycle);
 }

 private FarmingCycle resolveCycle(SalesOrderRequest request) {
  if (cycles == null) return null;
  if (request.cycleId() != null) {
   var c = cycles.findById(request.cycleId());
   if (c.isPresent()) return c.get();
  }
  String flockStr = request.flock();
  if (flockStr == null || flockStr.isBlank()) return null;
  flockStr = flockStr.trim();
  if (flockStr.matches("^\\d+$")) {
   try {
    Long id = Long.parseLong(flockStr);
    var c = cycles.findById(id);
    if (c.isPresent()) return c.get();
   } catch (Exception ignored) {}
  }
  var matcher = java.util.regex.Pattern.compile("L(\\d+)", java.util.regex.Pattern.CASE_INSENSITIVE).matcher(flockStr);
  if (matcher.find()) {
   try {
    Long id = Long.parseLong(matcher.group(1));
    var c = cycles.findById(id);
    if (c.isPresent()) return c.get();
   } catch (Exception ignored) {}
  }
  List<FarmingCycle> all = cycles.findAll();
  for (FarmingCycle c : all) {
   String code = String.format(java.util.Locale.ROOT, "L%06d", c.getId());
   if (flockStr.contains(code)) return c;
   if (c.getBarn() != null) {
    String barnName = c.getBarn().getName();
    String areaName = c.getBarn().getArea() != null ? c.getBarn().getArea().getName() : "";
    if (!barnName.isBlank() && flockStr.contains(barnName)) {
     if (areaName.isBlank() || flockStr.contains(areaName)) {
      return c;
     }
    }
   }
  }
  return null;
 }
}
