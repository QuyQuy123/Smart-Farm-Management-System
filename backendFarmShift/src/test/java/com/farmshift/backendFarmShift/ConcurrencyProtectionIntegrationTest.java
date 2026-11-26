package com.farmshift.backendFarmShift;

import com.farmshift.backendFarmShift.dto.request.InternalStockVoucherItemRequest;
import com.farmshift.backendFarmShift.dto.request.InternalStockVoucherRequest;
import com.farmshift.backendFarmShift.dto.request.PurchasePaymentRequest;
import com.farmshift.backendFarmShift.dto.request.SalesOrderRequest;
import com.farmshift.backendFarmShift.entity.*;
import com.farmshift.backendFarmShift.exception.BadRequestException;
import com.farmshift.backendFarmShift.repository.*;
import com.farmshift.backendFarmShift.service.InternalStockService;
import com.farmshift.backendFarmShift.service.PurchaseService;
import com.farmshift.backendFarmShift.service.SalesOrderService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.*;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
class ConcurrencyProtectionIntegrationTest {

    @Autowired PurchaseService purchaseService;
    @Autowired PurchaseInvoiceRepository invoiceRepository;
    @Autowired PurchasePaymentRepository paymentRepository;
    @Autowired SupplierRepository supplierRepository;
    @Autowired ProductTypeRepository productTypeRepository;

    @Autowired SalesOrderService salesOrderService;
    @Autowired SalesOrderRepository salesOrderRepository;
    @Autowired CustomerContactRepository customerContactRepository;
    @Autowired FarmAreaRepository areaRepository;
    @Autowired BarnRepository barnRepository;
    @Autowired FarmingCycleRepository cycleRepository;
    @Autowired FlockRepository flockRepository;
    @Autowired FlockMovementRepository movementRepository;

    @Autowired InternalStockService internalStockService;
    @Autowired InternalStockVoucherRepository voucherRepository;
    @Autowired InternalStockCategoryRepository stockCategoryRepository;
    @Autowired WarehouseCategoryRepository warehouseRepository;
    @Autowired ProductCategoryRepository productCategoryRepository;
    @Autowired InventoryItemRepository inventoryRepository;

    private final List<Long> createdInvoiceIds = new ArrayList<>();
    private final List<Long> createdSupplierIds = new ArrayList<>();
    private final List<Long> createdProductTypeIds = new ArrayList<>();
    private final List<String> createdSalesOrderIds = new ArrayList<>();
    private final List<Long> createdCustomerIds = new ArrayList<>();
    private final List<Long> createdFlockIds = new ArrayList<>();
    private final List<Long> createdCycleIds = new ArrayList<>();
    private final List<Long> createdBarnIds = new ArrayList<>();
    private final List<Long> createdAreaIds = new ArrayList<>();
    private final List<Long> createdVoucherIds = new ArrayList<>();
    private final List<Long> createdInventoryIds = new ArrayList<>();
    private final List<Long> createdProductIds = new ArrayList<>();
    private final List<Long> createdWarehouseIds = new ArrayList<>();

    @AfterEach
    void cleanup() {
        for (String orderId : createdSalesOrderIds) {
            salesOrderRepository.findById(orderId).ifPresent(o -> {
                FlockMovement mv = o.getHarvestMovement();
                salesOrderRepository.delete(o);
                if (mv != null) movementRepository.deleteById(mv.getId());
            });
        }
        createdSalesOrderIds.clear();
        for (Long cid : createdCustomerIds) customerContactRepository.deleteById(cid);
        createdCustomerIds.clear();
        for (Long fid : createdFlockIds) {
            movementRepository.findAll().stream()
                    .filter(m -> m.getFlock() != null && fid.equals(m.getFlock().getId()))
                    .forEach(m -> movementRepository.deleteById(m.getId()));
            flockRepository.deleteById(fid);
        }
        createdFlockIds.clear();
        for (Long cid : createdCycleIds) cycleRepository.deleteById(cid);
        createdCycleIds.clear();
        for (Long bid : createdBarnIds) barnRepository.deleteById(bid);
        createdBarnIds.clear();
        for (Long aid : createdAreaIds) areaRepository.deleteById(aid);
        createdAreaIds.clear();

        for (Long iid : createdInvoiceIds) {
            paymentRepository.findByInvoice_IdOrderByPaymentDateDescIdDesc(iid)
                    .forEach(p -> paymentRepository.deleteById(p.getId()));
            invoiceRepository.deleteById(iid);
        }
        createdInvoiceIds.clear();
        for (Long sid : createdSupplierIds) supplierRepository.deleteById(sid);
        createdSupplierIds.clear();
        for (Long ptid : createdProductTypeIds) productTypeRepository.deleteById(ptid);
        createdProductTypeIds.clear();

        for (Long vid : createdVoucherIds) voucherRepository.deleteById(vid);
        createdVoucherIds.clear();
        for (Long invId : createdInventoryIds) inventoryRepository.deleteById(invId);
        createdInventoryIds.clear();
        for (Long pid : createdProductIds) productCategoryRepository.deleteById(pid);
        createdProductIds.clear();
        for (Long wid : createdWarehouseIds) warehouseRepository.deleteById(wid);
        createdWarehouseIds.clear();
    }

    @Test
    void concurrentPaymentsOnSameInvoiceCannotExceedTotalOrLoseUpdate() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        ProductType pt = new ProductType();
        pt.setName("PT Lock " + suffix);
        pt.setNameKey("pt lock " + suffix);
        pt = productTypeRepository.saveAndFlush(pt);
        createdProductTypeIds.add(pt.getId());

        Supplier supplier = new Supplier();
        supplier.setCode("NCCLK" + suffix);
        supplier.setName("Supplier Lock " + suffix);
        supplier.setNameKey("supplier lock " + suffix);
        supplier.setRepresentative("Rep");
        supplier.setPhone("0912345678");
        supplier.setProductType(pt);
        supplier = supplierRepository.saveAndFlush(supplier);
        createdSupplierIds.add(supplier.getId());

        PurchaseInvoice invoice = new PurchaseInvoice();
        invoice.setCode("NHLK" + suffix);
        invoice.setSupplier(supplier);
        invoice.setInvoiceDate(LocalDate.now());
        invoice.setTotalAmount(1_000_000L);
        invoice.setPaidAmount(0L);
        invoice.setPaymentStatus("Trả sau");
        invoice.setStockStatus("Đã nhập kho");
        invoice = invoiceRepository.saveAndFlush(invoice);
        createdInvoiceIds.add(invoice.getId());
        final Long invoiceId = invoice.getId();

        List<Throwable> errors = runConcurrently(2, i ->
                purchaseService.pay(invoiceId, new PurchasePaymentRequest(1_000_000L, "Concurrent pay " + i))
        );

        assertEquals(1, errors.size(), "Exactly one concurrent full payment must fail; errors=" + errors);
        assertTrue(errors.getFirst() instanceof BadRequestException);

        PurchaseInvoice reloaded = invoiceRepository.findById(invoiceId).orElseThrow();
        assertEquals(1_000_000L, reloaded.getPaidAmount());
        assertEquals("Thanh toán hoàn tất", reloaded.getPaymentStatus());

        List<PurchasePayment> payments = paymentRepository.findByInvoice_IdOrderByPaymentDateDescIdDesc(invoiceId);
        assertEquals(1, payments.size());
        long sum = payments.stream().mapToLong(PurchasePayment::getAmount).sum();
        assertEquals(reloaded.getPaidAmount(), sum);
    }

    @Test
    void concurrentSalesOrdersCannotOversellFlockQuantity() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        FarmArea area = new FarmArea();
        area.setName("Area Sale Lock " + suffix);
        area.setNameKey("area sale lock " + suffix);
        area = areaRepository.saveAndFlush(area);
        createdAreaIds.add(area.getId());

        Barn barn = new Barn();
        barn.setArea(area);
        barn.setName("Barn Sale Lock " + suffix);
        barn.setNameKey("barn sale lock " + suffix);
        barn.setStatus(BarnStatus.ACTIVE);
        barn.setCapacity(500);
        barn.setCurrentQuantity(100);
        barn = barnRepository.saveAndFlush(barn);
        createdBarnIds.add(barn.getId());

        FarmingCycle cycle = new FarmingCycle();
        cycle.setBarn(barn);
        cycle.setCycleNumber(1);
        cycle.setStartDate(LocalDate.now().minusDays(20));
        cycle.setStatus(CycleStatus.ACTIVE);
        cycle = cycleRepository.saveAndFlush(cycle);
        createdCycleIds.add(cycle.getId());

        Flock flock = new Flock();
        flock.setCycle(cycle);
        flock.setName("Flock Sale Lock " + suffix);
        flock.setGender(FlockGender.MIXED);
        flock.setSourceType(FlockSource.PURCHASE);
        flock.setImportDate(LocalDate.now().minusDays(20));
        flock.setAgeAtImport(1);
        flock.setImportQuantity(100);
        flock.setImportAvgWeight(new BigDecimal("0.040"));
        flock.setUnitPrice(new BigDecimal("12000"));
        flock.setQuantity(100);
        flock.setStatus(FlockStatus.ACTIVE);
        flock = flockRepository.saveAndFlush(flock);
        createdFlockIds.add(flock.getId());

        String id1 = "sale-lock-1-" + suffix;
        String id2 = "sale-lock-2-" + suffix;
        createdSalesOrderIds.add(id1);
        createdSalesOrderIds.add(id2);

        final Long cycleId = cycle.getId();
        List<Throwable> errors = runConcurrently(2, i -> {
            String oid = i == 0 ? id1 : id2;
            salesOrderService.create(new SalesOrderRequest(
                    oid,
                    LocalDate.now(),
                    "Khách Lock " + i + " " + suffix,
                    "091234567" + i,
                    "Addr",
                    "Area - Barn",
                    70,
                    new BigDecimal("140"),
                    new BigDecimal("60000"),
                    "PAID",
                    null,
                    "Concurrent sale " + i,
                    null,
                    "Tiền mặt",
                    cycleId
            ));
        });

        salesOrderRepository.findById(id1).ifPresent(o -> {
            if (o.getBuyer() != null) createdCustomerIds.add(o.getBuyer().getId());
        });
        salesOrderRepository.findById(id2).ifPresent(o -> {
            if (o.getBuyer() != null) createdCustomerIds.add(o.getBuyer().getId());
        });

        assertEquals(1, errors.size(), "Exactly one concurrent overselling order must fail; errors=" + errors);
        assertTrue(errors.getFirst() instanceof BadRequestException);

        Flock reloadedFlock = flockRepository.findById(flock.getId()).orElseThrow();
        Barn reloadedBarn = barnRepository.findById(barn.getId()).orElseThrow();
        assertEquals(30, reloadedFlock.getQuantity());
        assertEquals(30, reloadedBarn.getCurrentQuantity());

        long persistedOrders = List.of(id1, id2).stream()
                .filter(id -> salesOrderRepository.findById(id).isPresent())
                .count();
        assertEquals(1, persistedOrders);

        List<FlockMovement> harvests = movementRepository.findAllByFlock_Cycle_IdOrderByMovementDateAscIdAsc(cycleId)
                .stream().filter(m -> m.getType() == FlockMovementType.HARVEST).toList();
        assertEquals(1, harvests.size());
        assertEquals(70, harvests.getFirst().getQuantity());
    }

    @Test
    void concurrentCancelOfTransferVoucherReversesStockExactlyOnce() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        WarehouseCategory src = new WarehouseCategory();
        src.setName("Kho Nguon Lock " + suffix);
        src.setNameKey("kho nguon lock " + suffix);
        src = warehouseRepository.saveAndFlush(src);
        createdWarehouseIds.add(src.getId());

        WarehouseCategory dst = new WarehouseCategory();
        dst.setName("Kho Dich Lock " + suffix);
        dst.setNameKey("kho dich lock " + suffix);
        dst = warehouseRepository.saveAndFlush(dst);
        createdWarehouseIds.add(dst.getId());

        ProductCategory prod = new ProductCategory();
        prod.setName("Cam Lock " + suffix);
        prod.setNameKey("cam lock " + suffix);
        prod.setWarehouse(src);
        prod = productCategoryRepository.saveAndFlush(prod);
        createdProductIds.add(prod.getId());

        InventoryItem srcItem = new InventoryItem();
        srcItem.setWarehouse(src);
        srcItem.setProduct(prod);
        srcItem.setPrice(new BigDecimal("300000"));
        srcItem.setStock(new BigDecimal("50.000000"));
        srcItem = inventoryRepository.saveAndFlush(srcItem);
        createdInventoryIds.add(srcItem.getId());

        InternalStockCategory transferCat = stockCategoryRepository.findByNameKey("chuyển kho nội bộ").orElseThrow();
        var voucherRes = internalStockService.create(new InternalStockVoucherRequest(
                "TRANSFER",
                transferCat.getId(),
                src.getId(),
                dst.getId(),
                null,
                LocalDate.now(),
                "Concurrent cancel test",
                null,
                List.of(new InternalStockVoucherItemRequest(prod.getId(), srcItem.getId(), null, new BigDecimal("20"), null, null))
        ), "owner@farm.test");
        createdVoucherIds.add(voucherRes.id());

        List<InventoryItem> dstItems = inventoryRepository.findByWarehouse_IdAndProduct_IdOrderByCreatedAtAscIdAsc(dst.getId(), prod.getId());
        assertEquals(1, dstItems.size());
        Long dstItemId = dstItems.getFirst().getId();
        createdInventoryIds.add(dstItemId);

        assertEquals(0, new BigDecimal("30").compareTo(inventoryRepository.findById(srcItem.getId()).orElseThrow().getStock()));
        assertEquals(0, new BigDecimal("20").compareTo(inventoryRepository.findById(dstItemId).orElseThrow().getStock()));

        List<Throwable> errors = runConcurrently(2, i -> internalStockService.cancel(voucherRes.id(), "owner@farm.test"));
        assertEquals(1, errors.size(), "Exactly one concurrent cancel must fail; errors=" + errors);
        assertTrue(errors.getFirst() instanceof BadRequestException);

        assertEquals("CANCELLED", voucherRepository.findById(voucherRes.id()).orElseThrow().getStatus());
        assertEquals(0, new BigDecimal("50").compareTo(inventoryRepository.findById(srcItem.getId()).orElseThrow().getStock()));
        assertEquals(0, new BigDecimal("0").compareTo(inventoryRepository.findById(dstItemId).orElseThrow().getStock()));
    }

    private List<Throwable> runConcurrently(int threads, IntConsumerThrowing action) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch ready = new CountDownLatch(threads);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<Throwable>> futures = new ArrayList<>();
        for (int i = 0; i < threads; i++) {
            final int idx = i;
            futures.add(pool.submit(() -> {
                ready.countDown();
                start.await(5, TimeUnit.SECONDS);
                try {
                    action.accept(idx);
                    return null;
                } catch (Throwable t) {
                    return t;
                }
            }));
        }
        assertTrue(ready.await(5, TimeUnit.SECONDS));
        start.countDown();
        List<Throwable> errors = new ArrayList<>();
        for (Future<Throwable> f : futures) {
            Throwable t = f.get(15, TimeUnit.SECONDS);
            if (t != null) errors.add(t);
        }
        pool.shutdownNow();
        return errors;
    }

    @FunctionalInterface
    private interface IntConsumerThrowing {
        void accept(int idx) throws Exception;
    }
}
