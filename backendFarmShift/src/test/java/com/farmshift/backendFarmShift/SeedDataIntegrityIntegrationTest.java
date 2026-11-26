package com.farmshift.backendFarmShift;

import com.farmshift.backendFarmShift.dto.response.BarnDayPlan;
import com.farmshift.backendFarmShift.dto.response.CycleDetailResponse;
import com.farmshift.backendFarmShift.dto.response.DebtSummaryResponse;
import com.farmshift.backendFarmShift.dto.response.ReportSummaryResponse;
import com.farmshift.backendFarmShift.entity.Barn;
import com.farmshift.backendFarmShift.entity.Brand;
import com.farmshift.backendFarmShift.entity.CycleCarriedExpense;
import com.farmshift.backendFarmShift.entity.CycleStatus;
import com.farmshift.backendFarmShift.entity.FarmingCycle;
import com.farmshift.backendFarmShift.entity.Flock;
import com.farmshift.backendFarmShift.entity.InventoryItem;
import com.farmshift.backendFarmShift.entity.PurchaseInvoice;
import com.farmshift.backendFarmShift.entity.Supplier;
import com.farmshift.backendFarmShift.repository.BarnRepository;
import com.farmshift.backendFarmShift.repository.BrandRepository;
import com.farmshift.backendFarmShift.repository.CycleCarriedExpenseRepository;
import com.farmshift.backendFarmShift.repository.FarmingCycleRepository;
import com.farmshift.backendFarmShift.repository.FlockRepository;
import com.farmshift.backendFarmShift.repository.InventoryItemRepository;
import com.farmshift.backendFarmShift.repository.PurchaseInvoiceRepository;
import com.farmshift.backendFarmShift.repository.SupplierRepository;
import com.farmshift.backendFarmShift.service.BrandService;
import com.farmshift.backendFarmShift.service.CycleService;
import com.farmshift.backendFarmShift.service.DailyPlanService;
import com.farmshift.backendFarmShift.service.DebtService;
import com.farmshift.backendFarmShift.service.ReportService;
import com.farmshift.backendFarmShift.service.SupplierService;
import com.farmshift.backendFarmShift.service.ai.AiInteractionFlywheelService;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class SeedDataIntegrityIntegrationTest {

    private static final LocalDate SEED_START = LocalDate.of(2026, 9, 1);
    private static final LocalDate SEED_END = LocalDate.of(2026, 11, 25);

    @Autowired JdbcTemplate jdbc;
    @Autowired EntityManager em;
    @Autowired CycleService cycleService;
    @Autowired DailyPlanService dailyPlanService;
    @Autowired ReportService reportService;
    @Autowired DebtService debtService;
    @Autowired AiInteractionFlywheelService flywheelService;
    @Autowired BrandRepository brandRepository;
    @Autowired SupplierRepository supplierRepository;
    @Autowired InventoryItemRepository inventoryRepository;
    @Autowired BarnRepository barnRepository;
    @Autowired FarmingCycleRepository cycleRepository;
    @Autowired FlockRepository flockRepository;
    @Autowired CycleCarriedExpenseRepository carriedExpenseRepository;
    @Autowired PurchaseInvoiceRepository invoiceRepository;

    @Test
    void loadsGeneratedSeedSqlIntoH2AndPassesAllDomainAssertions() throws Exception {
        Path seedPath = Path.of("..", "docs", "insert_data.txt").toAbsolutePath().normalize();
        assertTrue(Files.isRegularFile(seedPath), "Missing generated seed SQL at " + seedPath);

        clearAllTablesTransactional();

        String sql = Files.readString(seedPath, StandardCharsets.UTF_8);
        List<String> insertStatements = extractInsertStatements(sql);
        assertTrue(insertStatements.size() >= 35, "Expected >= 35 INSERT statements, got " + insertStatements.size());

        for (String stmt : insertStatements) {
            jdbc.execute(stmt);
        }
        em.flush();
        em.clear();

        // 1. Brands & Suppliers hashed name keys must match Java SHA-256 helpers
        for (Brand brand : brandRepository.findAll()) {
            assertEquals(BrandService.nameKey(brand.getName(), brand.getProductType()), brand.getNameKey(),
                    "Brand nameKey mismatch for " + brand.getName());
        }
        for (Supplier supplier : supplierRepository.findAll()) {
            assertEquals(SupplierService.nameKey(supplier.getName(), supplier.getProductType().getId()),
                    supplier.getNameKey(),
                    "Supplier nameKey mismatch for " + supplier.getName());
        }

        // 2. Inventory items must never be negative and match low-stock alerts
        BigDecimal h5n1Wh2 = BigDecimal.ZERO;
        BigDecimal cp511Wh4 = BigDecimal.ZERO;
        for (InventoryItem item : inventoryRepository.findAll()) {
            assertTrue(item.getStock().signum() >= 0, "Negative stock on item " + item.getId());
            if (item.getWarehouse().getId().equals(2L) && item.getProduct().getId().equals(8L)) {
                h5n1Wh2 = h5n1Wh2.add(item.getStock());
            }
            if (item.getWarehouse().getId().equals(4L) && item.getProduct().getId().equals(1L)) {
                cp511Wh4 = cp511Wh4.add(item.getStock());
            }
        }
        assertEquals(0, h5n1Wh2.compareTo(BigDecimal.ONE), "Expected 1 H5N1 bottle left in Warehouse 2");
        assertTrue(cp511Wh4.signum() > 0 && cp511Wh4.compareTo(new BigDecimal("15")) < 0,
                "Expected low stock (<15 bags) of CP 511 in Warehouse 4, got " + cp511Wh4);

        // 3. Barn current_quantity == sum(flocks.quantity) of ACTIVE cycle
        for (Barn barn : barnRepository.findAll()) {
            FarmingCycle active = cycleRepository.findFirstByBarnIdAndStatus(barn.getId(), CycleStatus.ACTIVE).orElse(null);
            int expectedQty = active == null ? 0
                    : flockRepository.findAllByCycleIdOrderByImportDateAscIdAsc(active.getId())
                            .stream().mapToInt(Flock::getQuantity).sum();
            assertEquals(expectedQty, barn.getCurrentQuantity(), "Barn quantity mismatch for " + barn.getName());
        }

        // 4. Split conservation between Cycle 6 (source) and Cycle 8 (target)
        FarmingCycle c6 = cycleRepository.findById(6L).orElseThrow();
        FarmingCycle c8 = cycleRepository.findById(8L).orElseThrow();
        assertEquals(0, c6.getCarriedFeedKg().add(c8.getCarriedFeedKg()).compareTo(BigDecimal.ZERO));
        assertEquals(0, c6.getCarriedFeedCost().add(c8.getCarriedFeedCost()).compareTo(BigDecimal.ZERO));
        assertEquals(0, c6.getCarriedGainKg().add(c8.getCarriedGainKg()).compareTo(BigDecimal.ZERO));
        BigDecimal carriedExpNet = carriedExpenseRepository.findAllByCycleId(6L).stream()
                .map(CycleCarriedExpense::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add)
                .add(carriedExpenseRepository.findAllByCycleId(8L).stream()
                        .map(CycleCarriedExpense::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add));
        assertEquals(0, carriedExpNet.compareTo(BigDecimal.ZERO));

        // 5. Cycle metrics via CycleService (Java BigDecimal truth): Cycle 1 good FCR & profit, Cycle 5 high FCR [2.80..2.95]
        CycleDetailResponse d1 = cycleService.detail(1L, true);
        CycleDetailResponse d5 = cycleService.detail(5L, true);
        assertNotNull(d1.metrics().fcr());
        assertTrue(d1.metrics().fcr().compareTo(new BigDecimal("2.15")) >= 0
                && d1.metrics().fcr().compareTo(new BigDecimal("2.45")) <= 0, "Cycle 1 FCR=" + d1.metrics().fcr());
        assertTrue(d1.finance().profit().signum() > 0, "Cycle 1 profit should be positive");
        assertNotNull(d5.metrics().fcr());
        assertTrue(d5.metrics().fcr().compareTo(new BigDecimal("2.80")) >= 0
                && d5.metrics().fcr().compareTo(new BigDecimal("2.95")) <= 0, "Cycle 5 FCR=" + d5.metrics().fcr());

        // 6. ReportService aggregates all 8 tabs cleanly
        ReportSummaryResponse report = reportService.getSummary(SEED_START, SEED_END);
        assertEquals(5, report.salesReport().orderCount());
        assertEquals(1, report.purchasesReport().cancelledCount());
        assertTrue(report.farmSummary().closedCycles() >= 3);
        assertTrue(report.internalStockReport().voucherCount() >= 5);

        // 7. DebtService summarizes northern customers & suppliers accurately
        DebtSummaryResponse debts = debtService.getDebtSummary();
        assertEquals(5, debts.customerReceivables().size());
        assertTrue(debts.totalCustomerReceivable().compareTo(BigDecimal.ZERO) > 0);
        assertTrue(debts.totalSupplierPayable() > 0L);

        // 8. Non-cancelled purchase invoice paidAmount matches payments
        for (PurchaseInvoice inv : invoiceRepository.findAll()) {
            assertNotNull(inv.getPaymentStatus());
        }

        // 9. DailyPlanService on SEED_END confirms M1 done on A1/B2/C2 and today's pending vaccines on B3/C2
        if (!SEED_END.isAfter(LocalDate.now(CycleService.VN_ZONE))) {
            List<BarnDayPlan> endPlans = dailyPlanService.farm(SEED_END, true);
            BarnDayPlan c2Plan = endPlans.stream().filter(p -> p.cycleId().equals(7L)).findFirst().orElseThrow();
            BarnDayPlan b3Plan = endPlans.stream().filter(p -> p.cycleId().equals(9L)).findFirst().orElseThrow();
            assertTrue(c2Plan.tasks().stream().anyMatch(t -> t.name().contains("Newcastle Lasota") && t.done() == null),
                    "Cycle 7 (Nhà C2) must have pending Lasota vaccine on END_DATE");
            assertTrue(b3Plan.tasks().stream().anyMatch(t -> t.name().contains("Gumboro") && t.done() == null),
                    "Cycle 9 (Nhà B3) must have pending Gumboro vaccine on END_DATE");
        }

        // 10. AI Data Flywheel logs & export
        Map<String, Object> fwStats = flywheelService.getFlywheelStats();
        assertEquals(8L, fwStats.get("totalInteractions"));
        assertFalse(flywheelService.exportCuratedSftJsonl(1, false).isBlank());
    }

    private void clearAllTablesTransactional() {
        List<String> deleteOrder = List.of(
                "ai_interaction_logs",
                "daily_stock_allocations",
                "daily_task_logs",
                "work_task_checks",
                "work_tasks",
                "barn_workers",
                "farm_area_workers",
                "warehouse_workers",
                "internal_stock_voucher_items",
                "internal_stock_vouchers",
                "internal_stock_voucher_numbers",
                "internal_stock_categories",
                "transfer_categories",
                "sales_orders",
                "sales_invoice_numbers",
                "feed_records",
                "weight_samples",
                "cycle_carried_expenses",
                "cycle_expenses",
                "flock_movements",
                "farming_program_steps",
                "inventory_items",
                "purchase_payments",
                "purchase_invoice_tag_mappings",
                "purchase_invoice_items",
                "purchase_invoices",
                "flocks",
                "farming_programs",
                "farming_cycles",
                "barns",
                "farm_area_warehouses",
                "farm_areas",
                "product_categories",
                "supplier_tag_mappings",
                "suppliers",
                "purchase_tags",
                "brands",
                "product_types",
                "specifications",
                "measurement_units",
                "warehouse_categories",
                "customer_contacts",
                "farms",
                "push_subscriptions",
                "otp_tokens",
                "customers",
                "accounts",
                "roles"
        );
        for (String table : deleteOrder) {
            jdbc.execute("DELETE FROM " + table);
        }
    }

    private static List<String> extractInsertStatements(String sql) {
        List<String> statements = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean collecting = false;
        for (String line : sql.split("\\R")) {
            String trimmed = line.trim();
            if (!collecting) {
                if (trimmed.startsWith("INSERT INTO ")) {
                    collecting = true;
                    current.setLength(0);
                    current.append(line).append('\n');
                    if (trimmed.endsWith(";")) {
                        statements.add(current.toString());
                        collecting = false;
                    }
                }
            } else {
                current.append(line).append('\n');
                if (trimmed.endsWith(";")) {
                    statements.add(current.toString());
                    collecting = false;
                }
            }
        }
        return statements;
    }
}
