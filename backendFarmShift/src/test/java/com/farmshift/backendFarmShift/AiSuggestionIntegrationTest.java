package com.farmshift.backendFarmShift;

import com.farmshift.backendFarmShift.dto.request.BarnWorkersRequest;
import com.farmshift.backendFarmShift.entity.*;
import com.farmshift.backendFarmShift.repository.*;
import com.farmshift.backendFarmShift.security.RoleNames;
import com.farmshift.backendFarmShift.service.AreaWarehouseService;
import com.farmshift.backendFarmShift.service.CycleService;
import com.farmshift.backendFarmShift.service.WorkAssignmentService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class AiSuggestionIntegrationTest {

    private static final String SUGGESTIONS_API = "/api/ai/suggestions";

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;

    @Autowired BarnRepository barnRepository;
    @Autowired FarmingCycleRepository cycleRepository;
    @Autowired FlockRepository flockRepository;
    @Autowired FlockMovementRepository movementRepository;
    @Autowired FeedRecordRepository feedRepository;
    @Autowired WeightSampleRepository weightRepository;
    @Autowired PurchaseInvoiceRepository invoiceRepository;
    @Autowired SupplierRepository supplierRepository;
    @Autowired ProductTypeRepository productTypeRepository;
    @Autowired ProductCategoryRepository productCategoryRepository;
    @Autowired WarehouseCategoryRepository warehouseRepository;
    @Autowired InventoryItemRepository inventoryRepository;
    @Autowired AccountRepository accountRepository;
    @Autowired RoleRepository roleRepository;
    @Autowired WorkTaskRepository workTaskRepository;
    @Autowired WorkAssignmentService workAssignmentService;

    @Test
    void testSuggestions_WorkerSeesOnlyAssignedBarnsAndNoFinancialTerms() throws Exception {
        LocalDate today = LocalDate.now(CycleService.VN_ZONE);

        long areaAId = id(postAsOwner("/api/farm-areas", Map.of("name", "Khu Mía A")));
        long areaBId = id(postAsOwner("/api/farm-areas", Map.of("name", "Khu Mía B")));
        long barnA1Id = id(postAsOwner("/api/barns", Map.of("areaId", areaAId, "name", "Nhà A1", "capacity", 5000, "areaM2", 450)));
        long barnB9Id = id(postAsOwner("/api/barns", Map.of("areaId", areaBId, "name", "Nhà B9", "capacity", 4500, "areaM2", 400)));

        long progId = id(postAsOwner("/api/farming-programs", Map.of(
                "name", "Gà Mía thương phẩm",
                "breed", "Gà Mía",
                "durationDays", 90,
                "steps", List.of(Map.of(
                        "category", "FEED",
                        "name", "Higro 01",
                        "dayFrom", 1,
                        "dayTo", 30,
                        "quantity", 20,
                        "mealsPerDay", 2
                ))
        )));

        long cycleA1Id = id(postAsOwner("/api/barns/" + barnA1Id + "/cycles",
                Map.of("startDate", today.minusDays(10).toString())));
        postAsOwner("/api/cycles/" + cycleA1Id + "/flocks", Map.of(
                "name", "Đàn A1",
                "programId", progId,
                "gender", "MALE",
                "importDate", today.minusDays(10).toString(),
                "ageAtImport", 1,
                "quantity", 2000,
                "avgWeight", 0.04,
                "unitPrice", 11000,
                "sourceNote", "Dabaco"
        )).andExpect(status().isCreated());

        long cycleB9Id = id(postAsOwner("/api/barns/" + barnB9Id + "/cycles",
                Map.of("startDate", today.minusDays(10).toString())));
        long flockB9Id = id(postAsOwner("/api/cycles/" + cycleB9Id + "/flocks", Map.of(
                "name", "Đàn B9",
                "programId", progId,
                "gender", "MALE",
                "importDate", today.minusDays(10).toString(),
                "ageAtImport", 1,
                "quantity", 2000,
                "avgWeight", 0.04,
                "unitPrice", 11000,
                "sourceNote", "Dabaco"
        )));

        // Mortality spike on unassigned Nhà B9 must NEVER leak to worker
        Flock flockB9 = flockRepository.findById(flockB9Id).orElseThrow();
        FlockMovement secretMortality = new FlockMovement();
        secretMortality.setFlock(flockB9);
        secretMortality.setType(FlockMovementType.DEATH);
        secretMortality.setMovementDate(today);
        secretMortality.setQuantity(25);
        secretMortality.setCreatedBy("owner@farm.test");
        movementRepository.saveAndFlush(secretMortality);

        // Unpaid draft purchase invoice must NEVER leak to worker
        seedUnimportedInvoice("HD-SUG-SECRET", "NCC Bí Mật", 50_000_000L, 0L);

        // Assign worker strictly to Nhà A1
        Account worker = ensureWorkerAccount("worker-sug@farm.test", "Công nhân A1");
        workAssignmentService.setBarnWorkers(barnA1Id, new BarnWorkersRequest(List.of(worker.getId())), "owner@farm.test");

        String body = mvc.perform(get(SUGGESTIONS_API)
                        .param("route", "/today-tasks")
                        .with(user("worker-sug@farm.test").authorities(new SimpleGrantedAuthority(RoleNames.FARM_WORKER))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value(RoleNames.FARM_WORKER))
                .andExpect(jsonPath("$.routeLabel").value("Việc hôm nay"))
                .andReturn()
                .getResponse()
                .getContentAsString();

        JsonNode json = mapper.readTree(body);
        int count = json.path("suggestions").size();
        assertTrue(count >= 3 && count <= 4, "Worker must receive 3-4 cards, got " + count);

        String placeholder = json.path("inputPlaceholder").asText().toLowerCase();
        assertFalse(placeholder.contains("nhập kho"), "Worker placeholder leaked nhập kho: " + placeholder);
        assertFalse(placeholder.contains("công nợ"), "Worker placeholder leaked công nợ: " + placeholder);
        assertFalse(placeholder.contains("hóa đơn"), "Worker placeholder leaked hóa đơn: " + placeholder);
        assertFalse(placeholder.contains("lãi/lỗ"), "Worker placeholder leaked lãi/lỗ: " + placeholder);
        assertFalse(placeholder.contains("đơn giá"), "Worker placeholder leaked đơn giá: " + placeholder);

        String lowerBody = body.toLowerCase();
        assertTrue(body.contains("Nhà A1"), "Assigned barn Nhà A1 should appear in worker suggestions: " + body);
        assertFalse(body.contains("Nhà B9"), "Unassigned barn Nhà B9 leaked to worker: " + body);
        assertFalse(lowerBody.contains("hóa đơn"), "Invoice info leaked to worker: " + body);
        assertFalse(lowerBody.contains("công nợ"), "Debt info leaked to worker: " + body);
        assertFalse(lowerBody.contains("nhập kho"), "Import info leaked to worker: " + body);
    }

    @Test
    void testSuggestions_AccountantSeesDraftInvoicesAndSupplierDebt() throws Exception {
        long areaId = id(postAsOwner("/api/farm-areas", Map.of("name", "Khu Kho Tổng")));
        WarehouseCategory feedWarehouse = warehouseRepository.findAllByArea_Id(areaId).stream()
                .filter(w -> AreaWarehouseService.FEED.equalsIgnoreCase(w.getKind()))
                .findFirst()
                .orElseThrow();

        ProductCategory product = new ProductCategory();
        product.setName("Cám Higro 511");
        product.setNameKey("cam higro 511");
        product.setWarehouse(feedWarehouse);
        product = productCategoryRepository.saveAndFlush(product);

        InventoryItem lowLot = new InventoryItem();
        lowLot.setWarehouse(feedWarehouse);
        lowLot.setProduct(product);
        lowLot.setPrice(new BigDecimal("350000"));
        lowLot.setStock(new BigDecimal("2"));
        inventoryRepository.saveAndFlush(lowLot);

        seedUnimportedInvoice("HD-ACC-001", "Cám CP Việt Nam", 120_000_000L, 20_000_000L);

        String purchasesBody = mvc.perform(get(SUGGESTIONS_API)
                        .param("route", "/purchases")
                        .with(user("accountant@farm.test").authorities(new SimpleGrantedAuthority(RoleNames.ACCOUNTANT))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value(RoleNames.ACCOUNTANT))
                .andExpect(jsonPath("$.routeLabel").value("Hóa đơn & Mua hàng"))
                .andReturn()
                .getResponse()
                .getContentAsString();

        JsonNode purchasesJson = mapper.readTree(purchasesBody);
        assertTrue(purchasesJson.path("suggestions").size() >= 3 && purchasesJson.path("suggestions").size() <= 4);

        JsonNode pendingImportCard = findCardById(purchasesJson, "acc_pending_import_invoices");
        JsonNode debtCard = findCardById(purchasesJson, "acc_supplier_debt");
        assertNotNull(pendingImportCard, "Accountant must see draft/unimported invoice card: " + purchasesBody);
        assertNotNull(debtCard, "Accountant must see supplier debt card: " + purchasesBody);

        String reportsBody = mvc.perform(get(SUGGESTIONS_API)
                        .param("route", "/reports")
                        .with(user("accountant@farm.test").authorities(new SimpleGrantedAuthority(RoleNames.ACCOUNTANT))))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        JsonNode pendingImportOnReports = findCardById(mapper.readTree(reportsBody), "acc_pending_import_invoices");
        assertNotNull(pendingImportOnReports);
        assertEquals(pendingImportOnReports.path("priorityScore").asInt() + 25,
                pendingImportCard.path("priorityScore").asInt(),
                "Route boost (+25) must apply to /purchases-targeted cards when opened on /purchases");
    }

    @Test
    void testSuggestions_OwnerSeesOverdueTasksAndFcrAlertWithRouteBoost() throws Exception {
        LocalDate today = LocalDate.now(CycleService.VN_ZONE);
        LocalTime now = LocalTime.now(CycleService.VN_ZONE);

        long areaId = id(postAsOwner("/api/farm-areas", Map.of("name", "Khu Mía Chủ Trại")));
        long barnId = id(postAsOwner("/api/barns", Map.of("areaId", areaId, "name", "Nhà FCR1", "capacity", 5000, "areaM2", 450)));
        Barn barn = barnRepository.findById(barnId).orElseThrow();

        long progId = id(postAsOwner("/api/farming-programs", Map.of(
                "name", "Chương trình Mía chuẩn",
                "breed", "Gà Mía",
                "durationDays", 90,
                "steps", List.of(Map.of(
                        "category", "FEED",
                        "name", "Higro 02",
                        "dayFrom", 1,
                        "dayTo", 60,
                        "quantity", 30,
                        "mealsPerDay", 2
                ))
        )));

        long cycleId = id(postAsOwner("/api/barns/" + barnId + "/cycles",
                Map.of("startDate", today.minusDays(25).toString())));
        postAsOwner("/api/cycles/" + cycleId + "/flocks", Map.of(
                "name", "Đàn FCR1",
                "programId", progId,
                "gender", "MALE",
                "importDate", today.minusDays(25).toString(),
                "ageAtImport", 1,
                "quantity", 1000,
                "avgWeight", 0.04,
                "unitPrice", 12000,
                "sourceNote", "Dabaco"
        )).andExpect(status().isCreated());

        FarmingCycle cycle = cycleRepository.findById(cycleId).orElseThrow();

        // Feed 4500kg for 1000 birds @ 1.50kg avg (~1460kg gain => FCR ~3.08 > 2.25 growing max)
        FeedRecord feed = new FeedRecord();
        feed.setCycle(cycle);
        feed.setRecordDate(today.minusDays(1));
        feed.setFeedName("Cám Higro 02");
        feed.setQuantityKg(new BigDecimal("4500.000"));
        feed.setUnitPrice(new BigDecimal("14000"));
        feed.setCreatedBy("owner@farm.test");
        feedRepository.saveAndFlush(feed);

        WeightSample sample = new WeightSample();
        sample.setCycle(cycle);
        sample.setSampleDate(today.minusDays(1));
        sample.setAvgWeightKg(new BigDecimal("1.500"));
        sample.setSampleSize(50);
        sample.setCreatedBy("owner@farm.test");
        weightRepository.saveAndFlush(sample);

        // Overdue task when VN local time allows strictly past dueTime
        Account worker = ensureWorkerAccount("worker-fcr@farm.test", "Công nhân FCR");
        if (now.isAfter(LocalTime.of(0, 5))) {
            WorkTask overdueTask = new WorkTask();
            overdueTask.setBarn(barn);
            overdueTask.setAssignee(worker);
            overdueTask.setTitle("Vệ sinh máng uống");
            overdueTask.setStartDate(today.minusDays(1));
            overdueTask.setEndDate(today.plusDays(2));
            overdueTask.setDueTime(now.minusMinutes(5));
            overdueTask.setCreatedBy("owner@farm.test");
            workTaskRepository.saveAndFlush(overdueTask);
        }

        String reportsBody = mvc.perform(get(SUGGESTIONS_API)
                        .param("route", "/reports")
                        .with(user("owner@farm.test").authorities(new SimpleGrantedAuthority(RoleNames.FARM_OWNER))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value(RoleNames.FARM_OWNER))
                .andExpect(jsonPath("$.routeLabel").value("Báo cáo"))
                .andReturn()
                .getResponse()
                .getContentAsString();

        JsonNode reportsJson = mapper.readTree(reportsBody);
        JsonNode fcrCardOnReports = findCardById(reportsJson, "owner_fcr_alert");
        assertNotNull(fcrCardOnReports, "Owner must receive FCR anomaly alert card: " + reportsBody);
        assertTrue(fcrCardOnReports.path("title").asText().contains("Nhà FCR1"));
        assertTrue(fcrCardOnReports.path("title").asText().contains("chuẩn ≤ 1.85"),
                "Stage 2 FCR suggestion card must use canonical 1.85 max benchmark: " + fcrCardOnReports.path("title").asText());

        // Also verify Stage 1 brooding cycle (age <= 21 days) uses canonical 1.35 max benchmark (aligned with AiAssistantService)
        long barnBroodId = id(postAsOwner("/api/barns", Map.of("areaId", areaId, "name", "Nhà Brood1", "capacity", 3000, "areaM2", 300)));
        long cycleBroodId = id(postAsOwner("/api/barns/" + barnBroodId + "/cycles",
                Map.of("startDate", today.minusDays(15).toString())));
        postAsOwner("/api/cycles/" + cycleBroodId + "/flocks", Map.of(
                "name", "Đàn Úm 16 ngày",
                "programId", progId,
                "gender", "MALE",
                "importDate", today.minusDays(15).toString(),
                "ageAtImport", 1,
                "quantity", 1000,
                "avgWeight", 0.04,
                "unitPrice", 12000,
                "sourceNote", "Dabaco"
        )).andExpect(status().isCreated());
        FarmingCycle broodCycle = cycleRepository.findById(cycleBroodId).orElseThrow();
        // Feed 1500kg for 1000 birds @ 0.44kg avg (gain ~400kg => FCR 3.75, excess over 1.35 = 2.40 > 3.08 - 1.85 = 1.23)
        FeedRecord broodFeed = new FeedRecord();
        broodFeed.setCycle(broodCycle);
        broodFeed.setRecordDate(today.minusDays(1));
        broodFeed.setFeedName("Cám CP 511");
        broodFeed.setQuantityKg(new BigDecimal("1500.000"));
        broodFeed.setUnitPrice(new BigDecimal("14000"));
        broodFeed.setCreatedBy("owner@farm.test");
        feedRepository.saveAndFlush(broodFeed);

        WeightSample broodSample = new WeightSample();
        broodSample.setCycle(broodCycle);
        broodSample.setSampleDate(today.minusDays(1));
        broodSample.setAvgWeightKg(new BigDecimal("0.440"));
        broodSample.setSampleSize(50);
        broodSample.setCreatedBy("owner@farm.test");
        weightRepository.saveAndFlush(broodSample);

        String broodReportsBody = mvc.perform(get(SUGGESTIONS_API)
                        .param("route", "/reports")
                        .with(user("owner@farm.test").authorities(new SimpleGrantedAuthority(RoleNames.FARM_OWNER))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        JsonNode broodFcrCard = findCardById(mapper.readTree(broodReportsBody), "owner_fcr_alert");
        assertNotNull(broodFcrCard);
        assertTrue(broodFcrCard.path("title").asText().contains("Nhà Brood1"));
        assertTrue(broodFcrCard.path("title").asText().contains("chuẩn ≤ 1.35"),
                "Stage 1 brooding FCR suggestion card must use canonical 1.35 max benchmark: " + broodFcrCard.path("title").asText());

        String purchasesBody = mvc.perform(get(SUGGESTIONS_API)
                        .param("route", "/purchases")
                        .with(user("owner@farm.test").authorities(new SimpleGrantedAuthority(RoleNames.FARM_OWNER))))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();

        JsonNode fcrCardOnPurchases = findCardById(mapper.readTree(purchasesBody), "owner_fcr_alert");
        assertNotNull(fcrCardOnPurchases);
        assertEquals(fcrCardOnPurchases.path("priorityScore").asInt() + 25,
                fcrCardOnReports.path("priorityScore").asInt(),
                "FCR card (/reports targetRoute) must gain +25 priorityScore on /reports vs /purchases");
    }

    @Test
    void testSuggestions_EmptyFarmReturnsGracefulFallbackCards() throws Exception {
        for (String role : List.of(RoleNames.FARM_OWNER, RoleNames.ACCOUNTANT, RoleNames.FARM_WORKER)) {
            String res = mvc.perform(get(SUGGESTIONS_API)
                            .param("route", "/dashboard")
                            .with(user("empty-" + role + "@farm.test").authorities(new SimpleGrantedAuthority(role))))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.role").value(role))
                    .andExpect(jsonPath("$.routeLabel").value("Bảng tin"))
                    .andReturn()
                    .getResponse()
                    .getContentAsString();

            JsonNode json = mapper.readTree(res);
            int size = json.path("suggestions").size();
            assertTrue(size >= 3 && size <= 4, "Role " + role + " should return 3-4 fallback cards on empty farm, got " + size);
            assertFalse(json.path("inputPlaceholder").asText().isBlank());
        }
    }

    // -------------------------------------------------------------- Helpers

    private void seedUnimportedInvoice(String code, String supplierName, long totalAmount, long paidAmount) {
        ProductType pt = productTypeRepository.findAll().stream().findFirst().orElseGet(() -> {
            ProductType type = new ProductType();
            type.setName("Thức ăn chăn nuôi");
            type.setNameKey("thức ăn chăn nuôi");
            return productTypeRepository.saveAndFlush(type);
        });

        Supplier supplier = new Supplier();
        supplier.setName(supplierName);
        supplier.setNameKey(supplierName.toLowerCase());
        supplier.setRepresentative("Đại diện");
        supplier.setPhone("0987654321");
        supplier.setProductType(pt);
        supplier = supplierRepository.saveAndFlush(supplier);

        PurchaseInvoice inv = new PurchaseInvoice();
        inv.setCode(code);
        inv.setSupplier(supplier);
        inv.setInvoiceDate(LocalDate.now(CycleService.VN_ZONE));
        inv.setTotalAmount(totalAmount);
        inv.setPaidAmount(paidAmount);
        inv.setPaymentStatus(paidAmount < totalAmount ? "Còn nợ" : "Thanh toán hoàn tất");
        inv.setStockStatus("Chưa nhập kho");
        invoiceRepository.saveAndFlush(inv);
    }

    private Account ensureWorkerAccount(String email, String fullName) {
        Role workerRole = roleRepository.findByName(RoleNames.FARM_WORKER).orElseGet(() -> {
            Role r = new Role();
            r.setName(RoleNames.FARM_WORKER);
            return roleRepository.saveAndFlush(r);
        });
        return accountRepository.findByEmail(email).orElseGet(() -> {
            Account worker = new Account();
            worker.setEmail(email);
            worker.setPassword("bcrypt-stub");
            worker.setFullName(fullName);
            worker.setRole(workerRole);
            worker.setIsActive(true);
            return accountRepository.saveAndFlush(worker);
        });
    }

    private JsonNode findCardById(JsonNode root, String id) {
        for (JsonNode card : root.path("suggestions")) {
            if (id.equals(card.path("id").asText())) {
                return card;
            }
        }
        return null;
    }

    private ResultActions postAsOwner(String url, Object body) throws Exception {
        return mvc.perform(post(url)
                .with(user("owner@farm.test").authorities(new SimpleGrantedAuthority(RoleNames.FARM_OWNER)))
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(body)));
    }

    private long id(ResultActions actions) throws Exception {
        String body = actions.andExpect(status().is2xxSuccessful()).andReturn().getResponse().getContentAsString();
        JsonNode root = mapper.readTree(body);
        if (root.hasNonNull("data") && root.path("data").has("id")) {
            return root.path("data").path("id").asLong();
        }
        return root.path("id").asLong();
    }
}
