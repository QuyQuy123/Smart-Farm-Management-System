package com.farmshift.backendFarmShift;

import com.farmshift.backendFarmShift.dto.request.*;
import com.farmshift.backendFarmShift.entity.*;
import com.farmshift.backendFarmShift.repository.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.anonymous;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@WithMockUser(username = "owner@farm.test", authorities = "ROLE_FARM_OWNER")
class ReportIntegrationTest {

    private static final LocalDate TODAY = LocalDate.now();
    private static final LocalDate START = TODAY.minusDays(20);

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired jakarta.persistence.EntityManager em;

    @Autowired FeedRecordRepository feedRepository;
    @Autowired FarmingCycleRepository cycleRepository;
    @Autowired DailyTaskLogRepository dailyTaskLogRepository;
    @Autowired WarehouseCategoryRepository warehouseRepository;
    @Autowired ProductCategoryRepository productCategoryRepository;
    @Autowired InventoryItemRepository inventoryRepository;
    @Autowired InternalStockCategoryRepository internalCategoryRepository;
    @Autowired PurchaseInvoiceRepository purchaseInvoiceRepository;

    long barnId;
    long cycleId;
    long flockId;

    @BeforeEach
    void setUp() throws Exception {
        // 1. Area, Barn, Program, Cycle, Flock, Losses, Harvest, Feed, Weight
        long areaId = id(post("/api/farm-areas", Map.of("name", "Khu Báo Cáo Test")));
        barnId = id(post("/api/barns", Map.of("areaId", areaId, "name", "Nhà BC-01", "capacity", 5000, "areaM2", 600)));
        long programId = id(post("/api/farming-programs", Map.of(
                "name", "Chương trình Mía Test",
                "breed", "Gà Mía",
                "durationDays", 90,
                "targetWeightMax", 2.1,
                "steps", List.of(Map.of("category", "FEED", "name", "Higro 01", "dayFrom", 1, "dayTo", 90, "quantity", 50, "mealsPerDay", 3))
        )));

        cycleId = id(post("/api/barns/" + barnId + "/cycles", Map.of("startDate", START.toString())));
        flockId = id(post("/api/cycles/" + cycleId + "/flocks", Map.of(
                "name", "ĐÀN BC-01",
                "programId", programId,
                "gender", "MIXED",
                "importDate", START.toString(),
                "ageAtImport", 1,
                "quantity", 1000,
                "avgWeight", 0.04,
                "unitPrice", 10000
        )));

        // Death: 20 con
        post("/api/flocks/" + flockId + "/losses", Map.of(
                "type", "DEATH",
                "movementDate", TODAY.minusDays(10).toString(),
                "quantity", 20
        )).andExpect(status().isCreated());

        // Harvest: 200 con, 400 kg @ 80,000 đ/kg = 32,000,000 đ
        post("/api/flocks/" + flockId + "/harvests", Map.of(
                "movementDate", TODAY.minusDays(2).toString(),
                "quantity", 200,
                "weightKg", 400,
                "unitPrice", 80000
        )).andExpect(status().isCreated());

        // Weight sample: 1.50 kg @ day 19
        post("/api/cycles/" + cycleId + "/weight-samples", Map.of(
                "sampleDate", TODAY.minusDays(1).toString(),
                "avgWeightKg", 1.50,
                "sampleSize", 30
        )).andExpect(status().isCreated());

        // Feed record: 3000 kg @ 14,000 đ/kg
        FarmingCycle cycle = cycleRepository.findById(cycleId).orElseThrow();
        FeedRecord feed = new FeedRecord();
        feed.setCycle(cycle);
        feed.setRecordDate(TODAY.minusDays(5));
        feed.setFeedName("Higro 01");
        feed.setQuantityKg(new BigDecimal("3000"));
        feed.setUnitPrice(new BigDecimal("14000"));
        feedRepository.save(feed);

        // Daily task log for Activity Feed
        DailyTaskLog taskLog = new DailyTaskLog();
        taskLog.setCycle(cycle);
        taskLog.setTaskDate(TODAY.minusDays(1));
        taskLog.setTaskKey("FEED::Higro 01::1");
        taskLog.setCategory(ProgramStepCategory.FEED);
        taskLog.setTaskName("Cho ăn sáng");
        taskLog.setActualQuantity(new BigDecimal("120"));
        taskLog.setUsageUnit(UsageUnit.KG);
        taskLog.setDoneBy("Công nhân An");
        taskLog.setDoneAt(LocalDateTime.now().minusHours(2));
        dailyTaskLogRepository.save(taskLog);

        // 2. Sales Order: 200 con, 400 kg, 80,000 đ/kg = 32,000,000 đ (paid 20,000,000 đ -> debt 12,000,000 đ)
        var saleBody = new java.util.HashMap<String, Object>();
        saleBody.put("id", UUID.randomUUID().toString());
        saleBody.put("date", TODAY.minusDays(2).toString());
        saleBody.put("customer", "Thương lái Báo Cáo");
        saleBody.put("phone", "0988776655");
        saleBody.put("address", "Xã Tân Dân, Sóc Sơn, Hà Nội");
        saleBody.put("flock", "Khu Báo Cáo Test - Nhà BC-01");
        saleBody.put("quantity", 200);
        saleBody.put("totalWeight", 400);
        saleBody.put("unitPrice", 80000);
        saleBody.put("status", "PARTIAL");
        saleBody.put("paidAmount", 20_000_000);
        post("/api/sales/orders", saleBody).andExpect(status().isOk());

        // 3. Purchases: 1 valid (10M, paid 4M -> debt 6M) + 1 cancelled (excluded from totals)
        post("/api/purchases", Map.of(
                "supplierName", "NCC Cám Report",
                "date", TODAY.minusDays(3).toString(),
                "paymentStatus", "Thanh toán một phần",
                "paidAmount", 4_000_000,
                "stockStatus", "Chưa nhập kho",
                "items", List.of(Map.of("name", "Cám test", "qty", 20, "unit", "Bao", "price", 500_000))
        )).andExpect(status().isCreated());

        var cancelledRes = post("/api/purchases", Map.of(
                "supplierName", "NCC Hủy Report",
                "date", TODAY.minusDays(3).toString(),
                "paymentStatus", "Trả sau",
                "stockStatus", "Đã hủy",
                "items", List.of(Map.of("name", "Cám hủy", "qty", 10, "unit", "Bao", "price", 500_000))
        )).andExpect(status().isCreated()).andReturn();
        long cancelledId = mapper.readTree(cancelledRes.getResponse().getContentAsString()).path("data").path("id").asLong();
        PurchaseInvoice cancelledPo = purchaseInvoiceRepository.findById(cancelledId).orElseThrow();
        cancelledPo.setStockStatus("Đã hủy");
        purchaseInvoiceRepository.saveAndFlush(cancelledPo);

        // 4. Inventory & Internal Stock
        WarehouseCategory whSrc = new WarehouseCategory();
        whSrc.setName("Kho Cám Report");
        whSrc.setNameKey("kho cam report " + UUID.randomUUID());
        whSrc = warehouseRepository.save(whSrc);

        WarehouseCategory whDst = new WarehouseCategory();
        whDst.setName("Kho Đệm Report");
        whDst.setNameKey("kho dem report " + UUID.randomUUID());
        whDst = warehouseRepository.save(whDst);

        ProductCategory prod = new ProductCategory();
        prod.setName("Vắc-xin Report");
        prod.setNameKey("vac xin report " + UUID.randomUUID());
        prod.setWarehouse(whSrc);
        prod = productCategoryRepository.save(prod);

        InventoryItem stockItem = new InventoryItem();
        stockItem.setWarehouse(whSrc);
        stockItem.setProduct(prod);
        stockItem.setStock(new BigDecimal("50"));
        stockItem.setMinStock(new BigDecimal("60")); // low stock!
        stockItem.setPrice(new BigDecimal("100000"));
        stockItem = inventoryRepository.saveAndFlush(stockItem);

        long transferCatId = internalCategoryRepository.findByNameKey("chuyển kho nội bộ").orElseThrow().getId();
        var transferReq = new InternalStockVoucherRequest(
                "TRANSFER", transferCatId, whSrc.getId(), whDst.getId(), null, TODAY.minusDays(1), null, "Chuyển nội bộ test",
                List.of(new InternalStockVoucherItemRequest(prod.getId(), stockItem.getId(), null, new BigDecimal("5"), null, null))
        );
        post("/api/internal-stock/vouchers", transferReq).andExpect(status().isCreated());

        // Second older PO outside 7-day range for date filtering test
        post("/api/purchases", Map.of(
                "supplierName", "NCC Cũ Ngoài 7 Ngày",
                "date", TODAY.minusDays(40).toString(),
                "paymentStatus", "Trả sau",
                "stockStatus", "Chưa nhập kho",
                "items", List.of(Map.of("name", "Cám cũ", "qty", 5, "unit", "Bao", "price", 400_000))
        )).andExpect(status().isCreated());

        em.flush();
        em.clear();
    }

    private ResultActions post(String url, Object body) throws Exception {
        return mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post(url)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(body)));
    }

    private long id(ResultActions res) throws Exception {
        return mapper.readTree(res.andExpect(status().isCreated()).andReturn().getResponse().getContentAsString())
                .path("data").path("id").asLong();
    }

    @Test
    void rbacEnforcesOwnerAndAccountantOnly() throws Exception {
        mvc.perform(get("/api/reports/summary").with(anonymous()))
                .andExpect(status().is4xxClientError());

        mvc.perform(get("/api/reports/summary").with(user("worker@farm.test").authorities(() -> "ROLE_FARM_WORKER")))
                .andExpect(status().isForbidden());

        mvc.perform(get("/api/reports/summary").with(user("acc@farm.test").authorities(() -> "ROLE_ACCOUNTANT")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    void aggregatesAllEightReportSectionsWithRealDatabaseCalculations() throws Exception {
        String raw = mvc.perform(get("/api/reports/summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andReturn().getResponse().getContentAsString();

        JsonNode data = mapper.readTree(raw).path("data");

        // Farm summary (1000 in - 20 death - 200 direct harvest - 200 sales-synced harvest = 580 live)
        JsonNode farm = data.path("farmSummary");
        assertTrue(farm.path("totalIn").asInt() >= 1000);
        assertTrue(farm.path("harvested").asInt() >= 400);
        assertTrue(farm.path("deaths").asInt() >= 20);
        assertTrue(farm.path("currentLive").asInt() >= 580);
        assertTrue(farm.path("cycles").toString().contains("Nhà BC-01"));

        // Sales
        JsonNode sales = data.path("salesReport");
        assertTrue(sales.path("orderCount").asInt() >= 1);
        assertTrue(sales.path("totalRevenue").asLong() >= 32_000_000L);
        assertTrue(sales.path("debtAmount").asLong() >= 12_000_000L);
        assertTrue(sales.path("orders").toString().contains("Thương lái Báo Cáo"));

        // Purchases (cancelled excluded from valid invoiceCount / totalAmount)
        JsonNode purchases = data.path("purchasesReport");
        assertTrue(purchases.path("invoiceCount").asInt() >= 1);
        assertTrue(purchases.path("cancelledCount").asInt() >= 1);
        assertTrue(purchases.path("invoices").toString().contains("NCC Cám Report"));

        // Inventory valuation & low-stock check (45 * 100,000 after 5 transferred)
        JsonNode inventory = data.path("inventoryReport");
        assertTrue(inventory.path("totalSkus").asInt() >= 1);
        assertTrue(inventory.path("lowStockCount").asInt() >= 1);
        assertTrue(inventory.path("items").toString().contains("Vắc-xin Report"));

        // Harvest report
        JsonNode harvest = data.path("harvestReport");
        assertTrue(harvest.path("totalHead").asInt() >= 200);
        assertTrue(harvest.path("totalWeightKg").asDouble() >= 400.0);
        assertTrue(harvest.path("rows").toString().contains("Nhà BC-01"));

        // Growth / FCR: currentQty=780 * 1.50kg + 400kg out - 40kg in = 1530kg gain, feed 3000kg -> FCR ~ 1.96
        JsonNode growth = data.path("growthReport");
        assertTrue(growth.path("analyzedCycles").asInt() >= 1);
        assertTrue(growth.path("avgFcr").asDouble() > 0);
        assertTrue(growth.path("cycles").toString().contains("Nhà BC-01"));

        // Internal stock
        JsonNode internal = data.path("internalStockReport");
        assertTrue(internal.path("transferCount").asInt() >= 1);
        assertTrue(internal.path("totalAmount").asLong() >= 500_000L);

        // Activity feed
        JsonNode activity = data.path("activityReport");
        assertTrue(activity.path("totalActivities").asInt() >= 4);
        assertTrue(activity.path("items").toString().contains("Công nhân An"));
    }

    @Test
    void filtersHarvestAndPurchasesByDateRange() throws Exception {
        String from = TODAY.minusDays(7).toString();
        String to = TODAY.toString();

        String raw = mvc.perform(get("/api/reports/summary")
                        .param("from", from)
                        .param("to", to))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        JsonNode data = mapper.readTree(raw).path("data");
        assertEquals(from, data.path("from").asText());
        assertEquals(to, data.path("to").asText());

        // Out-of-range 40-day-old PO ("NCC Cũ Ngoài 7 Ngày") must NOT appear when querying last 7 days
        String purchasesJson = data.path("purchasesReport").path("invoices").toString();
        assertTrue(purchasesJson.contains("NCC Cám Report"));
        assertFalse(purchasesJson.contains("NCC Cũ Ngoài 7 Ngày"));
    }
}
