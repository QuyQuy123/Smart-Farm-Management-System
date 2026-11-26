package com.farmshift.backendFarmShift;

import com.farmshift.backendFarmShift.entity.*;
import com.farmshift.backendFarmShift.repository.*;
import com.farmshift.backendFarmShift.service.CycleService;
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
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class CycleDiseaseIntegrationTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired FarmAreaRepository areaRepository;
    @Autowired BarnRepository barnRepository;
    @Autowired FarmingCycleRepository cycleRepository;
    @Autowired WarehouseCategoryRepository warehouseRepository;
    @Autowired ProductCategoryRepository productRepository;
    @Autowired MeasurementUnitRepository unitRepository;
    @Autowired InventoryItemRepository inventoryRepository;
    @Autowired CycleExpenseRepository expenseRepository;
    @Autowired CycleDiseaseRepository diseaseRepository;
    @Autowired DiseaseTreatmentLogRepository treatmentLogRepository;
    @Autowired com.farmshift.backendFarmShift.service.CycleDiseaseService cycleDiseaseService;
    @Autowired org.springframework.transaction.PlatformTransactionManager txManager;
    @Autowired AccountRepository accountRepository;
    @Autowired RoleRepository roleRepository;

    private FarmingCycle cycle;
    private InventoryItem lot1;
    private InventoryItem lot2;
    private LocalDate today;

    @BeforeEach
    void setUp() {
        today = LocalDate.now(CycleService.VN_ZONE);

        Role workerRole = roleRepository.findByName("ROLE_FARM_WORKER").orElseGet(() -> {
            Role r = new Role();
            r.setName("ROLE_FARM_WORKER");
            return roleRepository.save(r);
        });

        Account assignedWorker = new Account();
        assignedWorker.setEmail("worker.assigned@farm.test");
        assignedWorker.setFullName("Công nhân chuồng 1");
        assignedWorker.setPassword("secret");
        assignedWorker.setRole(workerRole);
        assignedWorker.setIsActive(true);
        assignedWorker = accountRepository.save(assignedWorker);

        Account otherWorker = new Account();
        otherWorker.setEmail("worker.other@farm.test");
        otherWorker.setFullName("Công nhân khu khác");
        otherWorker.setPassword("secret");
        otherWorker.setRole(workerRole);
        otherWorker.setIsActive(true);
        accountRepository.save(otherWorker);

        FarmArea area = new FarmArea();
        area.setName("Khu Bệnh Án");
        area.setNameKey("khu bệnh án");
        area.getWorkers().add(assignedWorker);
        area = areaRepository.save(area);

        WarehouseCategory medWh = new WarehouseCategory();
        medWh.setName("Kho thuốc Khu Bệnh Án");
        medWh.setNameKey("kho thuốc khu bệnh án");
        medWh.setKind("MEDICINE");
        medWh.setArea(area);
        medWh = warehouseRepository.save(medWh);
        area.getWarehouses().add(medWh);
        areaRepository.save(area);

        Barn barn = new Barn();
        barn.setArea(area);
        barn.setName("Chuồng A1");
        barn.setNameKey("chuồng a1");
        barn.setCapacity(1000);
        barn.setStatus(BarnStatus.ACTIVE);
        barn = barnRepository.save(barn);

        cycle = new FarmingCycle();
        cycle.setBarn(barn);
        cycle.setCycleNumber(1);
        cycle.setStartDate(today.minusDays(10));
        cycle.setStatus(CycleStatus.ACTIVE);
        cycle = cycleRepository.save(cycle);

        ProductCategory med = new ProductCategory();
        med.setName("Baycox Cầu Trùng");
        med.setNameKey("baycox cầu trùng");
        med = productRepository.save(med);

        MeasurementUnit bottle = new MeasurementUnit();
        bottle.setCode("CHAI1L");
        bottle.setCodeKey("chai1l");
        bottle.setName("Chai 1L");
        bottle.setNameKey("chai 1l");
        bottle.setContentQuantity(BigDecimal.ONE);
        bottle.setContentUnit(UsageUnit.L);
        bottle = unitRepository.save(bottle);

        lot1 = new InventoryItem();
        lot1.setWarehouse(medWh);
        lot1.setProduct(med);
        lot1.setUnit(bottle);
        lot1.setStock(new BigDecimal("2.000000"));
        lot1.setPrice(new BigDecimal("100000.00"));
        lot1.setCreatedAt(LocalDateTime.now(CycleService.VN_ZONE).minusDays(5));
        lot1 = inventoryRepository.save(lot1);

        lot2 = new InventoryItem();
        lot2.setWarehouse(medWh);
        lot2.setProduct(med);
        lot2.setUnit(bottle);
        lot2.setStock(new BigDecimal("3.000000"));
        lot2.setPrice(new BigDecimal("120000.00"));
        lot2.setCreatedAt(LocalDateTime.now(CycleService.VN_ZONE).minusDays(1));
        lot2 = inventoryRepository.save(lot2);
    }

    @Test
    @WithMockUser(username = "owner@farm.test", authorities = "ROLE_FARM_OWNER")
    void tracksMultiDayDiseaseAcrossFifoLotsAndReturnsStockOnUndo() throws Exception {
        String base = "/api/cycles/" + cycle.getId() + "/diseases";

        // 1. Create disease
        String createdJson = mvc.perform(post(base)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of(
                                "diseaseName", "Bệnh cầu trùng",
                                "symptoms", "Phân sáp, xù lông",
                                "startDate", today.minusDays(2).toString(),
                                "affectedQuantity", 50
                        ))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.status").value("ACTIVE"))
                .andExpect(jsonPath("$.data.totalMedicineCost").value(0))
                .andReturn().getResponse().getContentAsString();
        long diseaseId = mapper.readTree(createdJson).path("data").path("id").asLong();

        // 2. Day 1 treatment: take 2.5 bottles -> FIFO consumes 2 from lot1 (2*100k) + 0.5 from lot2 (0.5*120k) = 260,000 VND
        String t1Json = mvc.perform(post(base + "/" + diseaseId + "/treatments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of(
                                "treatmentDate", today.minusDays(2).toString(),
                                "method", "AUTO_DRINKER",
                                "dosageText", "1 ml/lít nước",
                                "inventoryItemId", lot1.getId(),
                                "stockQuantity", 2.5
                        ))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.totalMedicineCost").value(260000))
                .andExpect(jsonPath("$.data.treatments.length()").value(1))
                .andReturn().getResponse().getContentAsString();
        long t1Id = mapper.readTree(t1Json).path("data").path("treatments").get(0).path("id").asLong();

        assertThat(inventoryRepository.findById(lot1.getId()).orElseThrow().getStock()).isEqualByComparingTo("0.000000");
        assertThat(inventoryRepository.findById(lot2.getId()).orElseThrow().getStock()).isEqualByComparingTo("2.500000");

        // 3. Day 2 treatment: take 1 bottle from lot2 (120,000 VND) -> total disease cost = 380,000 VND
        mvc.perform(post(base + "/" + diseaseId + "/treatments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of(
                                "treatmentDate", today.minusDays(1).toString(),
                                "method", "AUTO_DRINKER",
                                "inventoryItemId", lot1.getId(),
                                "stockQuantity", 1
                        ))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.totalMedicineCost").value(380000))
                .andExpect(jsonPath("$.data.treatments.length()").value(2));

        // Verify exactly 2 CycleExpense(MEDICINE) rows created (no duplication)
        List<CycleExpense> expenses = expenseRepository.findAllByCycleIdOrderByExpenseDateDescIdDesc(cycle.getId());
        assertThat(expenses).hasSize(2);
        BigDecimal totalExpense = expenses.stream().map(CycleExpense::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        assertThat(totalExpense).isEqualByComparingTo("380000");

        // Manual deletion of disease-linked CycleExpense must be blocked
        mvc.perform(delete("/api/cycles/" + cycle.getId() + "/expenses/" + expenses.getFirst().getId()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errorCode").value("RECORD_FROM_DISEASE_LOG"));

        // Deleting disease with existing treatments must be blocked
        mvc.perform(delete(base + "/" + diseaseId))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errorCode").value("DISEASE_HAS_TREATMENTS"));

        // Exceeding remaining stock (only 1.5 left) throws STOCK_NOT_ENOUGH (MSG27)
        mvc.perform(post(base + "/" + diseaseId + "/treatments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of(
                                "treatmentDate", today.toString(),
                                "inventoryItemId", lot1.getId(),
                                "stockQuantity", 5
                        ))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("STOCK_NOT_ENOUGH"));

        // 4. Undo Day 1 treatment -> restores 2 to lot1 AND 0.5 to lot2 1:1, reduces totalMedicineCost to 120,000, deletes CycleExpense
        mvc.perform(delete(base + "/" + diseaseId + "/treatments/" + t1Id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalMedicineCost").value(120000))
                .andExpect(jsonPath("$.data.treatments.length()").value(1));

        assertThat(inventoryRepository.findById(lot1.getId()).orElseThrow().getStock()).isEqualByComparingTo("2.000000");
        assertThat(inventoryRepository.findById(lot2.getId()).orElseThrow().getStock()).isEqualByComparingTo("2.000000");
        assertThat(expenseRepository.findAllByCycleIdOrderByExpenseDateDescIdDesc(cycle.getId())).hasSize(1);

        // 5. Reject marking RECOVERED with endDate before the remaining treatment date (today - 1)
        mvc.perform(put(base + "/" + diseaseId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of("status", "RECOVERED", "endDate", today.minusDays(2).toString()))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("DISEASE_END_BEFORE_TREATMENT"));

        // 6. Mark RECOVERED on valid endDate
        mvc.perform(put(base + "/" + diseaseId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of("status", "RECOVERED", "endDate", today.toString()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("RECOVERED"))
                .andExpect(jsonPath("$.data.endDate").value(today.toString()));

        // 7. Adding treatment to RECOVERED disease must be rejected with 409 DISEASE_ALREADY_RECOVERED
        mvc.perform(post(base + "/" + diseaseId + "/treatments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of(
                                "treatmentDate", today.toString(),
                                "medicineName", "Thuốc thêm",
                                "manualCost", 50000
                        ))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errorCode").value("DISEASE_ALREADY_RECOVERED"));
    }

    @Test
    @WithMockUser(username = "owner@farm.test", authorities = "ROLE_FARM_OWNER")
    void rejectsFeedWarehouseItemProtectsInventoryDeleteAndCapsClosedCycleTreatmentDays() throws Exception {
        // Setup FEED warehouse in the same area
        FarmArea area = cycle.getBarn().getArea();
        WarehouseCategory feedWh = new WarehouseCategory();
        feedWh.setName("Kho cám Khu Bệnh Án");
        feedWh.setNameKey("kho cám khu bệnh án");
        feedWh.setKind("FEED");
        feedWh.setArea(area);
        feedWh = warehouseRepository.save(feedWh);
        area.getWarehouses().add(feedWh);
        areaRepository.save(area);

        ProductCategory feedProd = new ProductCategory();
        feedProd.setName("Cám mảnh 01");
        feedProd.setNameKey("cám mảnh 01");
        feedProd = productRepository.save(feedProd);

        InventoryItem feedLot = new InventoryItem();
        feedLot.setWarehouse(feedWh);
        feedLot.setProduct(feedProd);
        feedLot.setUnit(lot1.getUnit());
        feedLot.setStock(new BigDecimal("10.000000"));
        feedLot.setPrice(new BigDecimal("300000.00"));
        feedLot = inventoryRepository.save(feedLot);

        String base = "/api/cycles/" + cycle.getId() + "/diseases";
        String createdJson = mvc.perform(post(base)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of(
                                "diseaseName", "E.coli",
                                "startDate", today.minusDays(5).toString()
                        ))))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long diseaseId = mapper.readTree(createdJson).path("data").path("id").asLong();

        // 1. FEED warehouse item must be rejected with 400 STOCK_SOURCE_INVALID
        mvc.perform(post(base + "/" + diseaseId + "/treatments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of(
                                "treatmentDate", today.minusDays(4).toString(),
                                "inventoryItemId", feedLot.getId(),
                                "stockQuantity", 1
                        ))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("STOCK_SOURCE_INVALID"));

        // 2. Drain lot1 completely (2 bottles) via disease treatment, then DELETE /api/inventory-items/{lot1} -> 409 INVENTORY_IN_USE (not 500)
        mvc.perform(post(base + "/" + diseaseId + "/treatments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of(
                                "treatmentDate", today.minusDays(4).toString(),
                                "inventoryItemId", lot1.getId(),
                                "stockQuantity", 2
                        ))))
                .andExpect(status().isCreated());
        assertThat(inventoryRepository.findById(lot1.getId()).orElseThrow().getStock()).isEqualByComparingTo("0.000000");

        mvc.perform(delete("/api/inventory-items/" + lot1.getId()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errorCode").value("INVENTORY_IN_USE"));

        // 3. Closed cycle with ACTIVE disease (endDate == null) caps treatmentDays at cycle.endDate (3 days: -5 to -3)
        cycle.setStatus(CycleStatus.CLOSED);
        cycle.setEndDate(today.minusDays(3));
        cycleRepository.saveAndFlush(cycle);

        mvc.perform(get(base))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].treatmentDays").value(3));
    }

    @Test
    void enforcesRbacForAssignedWorkerUnassignedWorkerAndAccountant() throws Exception {
        String base = "/api/cycles/" + cycle.getId() + "/diseases";

        // Unassigned worker gets 409 BARN_NOT_ASSIGNED (WorkAssignmentService standard)
        mvc.perform(get(base).with(user("worker.other@farm.test").authorities(() -> "ROLE_FARM_WORKER")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errorCode").value("BARN_NOT_ASSIGNED"));

        // Assigned worker can create disease & log stock treatment, but ALL financial fields MUST be null
        String createdJson = mvc.perform(post(base)
                        .with(user("worker.assigned@farm.test").authorities(() -> "ROLE_FARM_WORKER"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of(
                                "diseaseName", "CRD hô hấp",
                                "startDate", today.toString()
                        ))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.totalMedicineCost").doesNotExist())
                .andReturn().getResponse().getContentAsString();
        long diseaseId = mapper.readTree(createdJson).path("data").path("id").asLong();

        mvc.perform(post(base + "/" + diseaseId + "/treatments")
                        .with(user("worker.assigned@farm.test").authorities(() -> "ROLE_FARM_WORKER"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of(
                                "treatmentDate", today.toString(),
                                "inventoryItemId", lot1.getId(),
                                "stockQuantity", 1
                        ))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.totalMedicineCost").doesNotExist())
                .andExpect(jsonPath("$.data.treatments[0].unitPrice").doesNotExist())
                .andExpect(jsonPath("$.data.treatments[0].cost").doesNotExist());

        // Accountant can view costs (100,000 VND) but cannot create/mutate diseases
        mvc.perform(get(base).with(user("acc@farm.test").authorities(() -> "ROLE_ACCOUNTANT")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].totalMedicineCost").value(100000))
                .andExpect(jsonPath("$.data[0].treatments[0].cost").value(100000));

        mvc.perform(post(base)
                        .with(user("acc@farm.test").authorities(() -> "ROLE_ACCOUNTANT"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of("diseaseName", "Test", "startDate", today.toString()))))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "owner@farm.test", authorities = "ROLE_FARM_OWNER")
    void closeCycleValidatesDiseaseAndZeroCostTreatmentDatesAndAutoRecoversActiveDiseases() throws Exception {
        String base = "/api/cycles/" + cycle.getId() + "/diseases";

        // Declare an ACTIVE disease starting at today - 4
        String createdJson = mvc.perform(post(base)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of(
                                "diseaseName", "Viêm ruột hoại tử",
                                "startDate", today.minusDays(4).toString()
                        ))))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long diseaseId = mapper.readTree(createdJson).path("data").path("id").asLong();

        // Log a zero-cost external medicine treatment on today - 2 (no CycleExpense created)
        mvc.perform(post(base + "/" + diseaseId + "/treatments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of(
                                "treatmentDate", today.minusDays(2).toString(),
                                "medicineName", "Amoxicillin mua lẻ"
                        ))))
                .andExpect(status().isCreated());
        assertThat(expenseRepository.findAllByCycleIdOrderByExpenseDateDescIdDesc(cycle.getId())).isEmpty();

        // Closing before disease startDate (today - 5 < today - 4) must be rejected
        mvc.perform(post("/api/cycles/" + cycle.getId() + "/close")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of("endDate", today.minusDays(5).toString()))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("CYCLE_END_DATE"));

        // Closing before zero-cost treatmentDate (today - 3 < today - 2) must also be rejected
        mvc.perform(post("/api/cycles/" + cycle.getId() + "/close")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of("endDate", today.minusDays(3).toString()))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("CYCLE_END_DATE"));

        // Closing on valid date (today - 1) succeeds and transitions ACTIVE disease to RECOVERED with endDate = today - 1
        LocalDate closeDate = today.minusDays(1);
        mvc.perform(post("/api/cycles/" + cycle.getId() + "/close")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of("endDate", closeDate.toString()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("CLOSED"));

        mvc.perform(get(base))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].status").value("RECOVERED"))
                .andExpect(jsonPath("$.data[0].endDate").value(closeDate.toString()))
                .andExpect(jsonPath("$.data[0].treatmentDays").value(4));
    }

    @Test
    void accountantAndOwnerCanUpdateExternalMedicineCostWhileBlockingWorkerStockAndOverflow() throws Exception {
        String base = "/api/cycles/" + cycle.getId() + "/diseases";

        // 1. Assigned worker creates disease and logs external medicine (cost = 0, no CycleExpense)
        String diseaseJson = mvc.perform(post(base)
                        .with(user("worker.assigned@farm.test").authorities(() -> "ROLE_FARM_WORKER"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of(
                                "diseaseName", "Cầu trùng cấp",
                                "startDate", today.minusDays(1).toString()
                        ))))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long diseaseId = mapper.readTree(diseaseJson).path("data").path("id").asLong();

        String extTreatJson = mvc.perform(post(base + "/" + diseaseId + "/treatments")
                        .with(user("worker.assigned@farm.test").authorities(() -> "ROLE_FARM_WORKER"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of(
                                "treatmentDate", today.minusDays(1).toString(),
                                "medicineName", "Toltrazuril mua ngoài",
                                "method", "HAND_DRINKER"
                        ))))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long extTreatmentId = mapper.readTree(extTreatJson).path("data").path("treatments").get(0).path("id").asLong();
        assertThat(expenseRepository.findAllByCycleIdOrderByExpenseDateDescIdDesc(cycle.getId())).isEmpty();

        // Also log a warehouse stock treatment (1 bottle of lot1 = 100,000 VND)
        String stockTreatJson = mvc.perform(post(base + "/" + diseaseId + "/treatments")
                        .with(user("worker.assigned@farm.test").authorities(() -> "ROLE_FARM_WORKER"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of(
                                "treatmentDate", today.toString(),
                                "inventoryItemId", lot1.getId(),
                                "stockQuantity", 1
                        ))))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long stockTreatmentId = mapper.readTree(stockTreatJson).path("data").path("treatments").get(1).path("id").asLong();

        String costUrl = base + "/" + diseaseId + "/treatments/" + extTreatmentId + "/cost";

        // 2. Worker is forbidden from updating treatment cost
        mvc.perform(put(costUrl)
                        .with(user("worker.assigned@farm.test").authorities(() -> "ROLE_FARM_WORKER"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of("manualCost", 150000))))
                .andExpect(status().isForbidden());

        // 3. Accountant updates external medicine cost to 180,000 -> creates CycleExpense(MEDICINE) & updates totalMedicineCost to 280,000
        mvc.perform(put(costUrl)
                        .with(user("acc@farm.test").authorities(() -> "ROLE_ACCOUNTANT"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of("manualCost", 180000))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalMedicineCost").value(280000))
                .andExpect(jsonPath("$.data.treatments[0].cost").value(180000));
        assertThat(expenseRepository.findAllByCycleIdOrderByExpenseDateDescIdDesc(cycle.getId())).hasSize(2);

        // 4. Even after worker marks disease RECOVERED on active cycle, Owner can still adjust external cost to 220,000 (updates same CycleExpense)
        mvc.perform(put(base + "/" + diseaseId)
                        .with(user("worker.assigned@farm.test").authorities(() -> "ROLE_FARM_WORKER"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of("status", "RECOVERED", "endDate", today.toString()))))
                .andExpect(status().isOk());

        mvc.perform(put(costUrl)
                        .with(user("owner@farm.test").authorities(() -> "ROLE_FARM_OWNER"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of("manualCost", 220000))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalMedicineCost").value(320000));
        assertThat(expenseRepository.findAllByCycleIdOrderByExpenseDateDescIdDesc(cycle.getId())).hasSize(2);

        // 5. Accountant sets external cost back to 0 -> deletes linked CycleExpense cleanly
        mvc.perform(put(costUrl)
                        .with(user("acc@farm.test").authorities(() -> "ROLE_ACCOUNTANT"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of("manualCost", 0))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalMedicineCost").value(100000))
                .andExpect(jsonPath("$.data.treatments[0].cost").value(0))
                .andExpect(jsonPath("$.data.treatments[0].expenseId").doesNotExist());
        assertThat(expenseRepository.findAllByCycleIdOrderByExpenseDateDescIdDesc(cycle.getId())).hasSize(1);

        // 6. Updating manualCost on a warehouse stock treatment must be rejected with 400 TREATMENT_FROM_STOCK
        mvc.perform(put(base + "/" + diseaseId + "/treatments/" + stockTreatmentId + "/cost")
                        .with(user("acc@farm.test").authorities(() -> "ROLE_ACCOUNTANT"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of("manualCost", 99000))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("TREATMENT_FROM_STOCK"));

        // 7. Upper-bound numeric overflow checks return 400 Bad Request instead of 500 DataIntegrityViolationException
        mvc.perform(put(costUrl)
                        .with(user("acc@farm.test").authorities(() -> "ROLE_ACCOUNTANT"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of("manualCost", new BigDecimal("100000000000000")))))
                .andExpect(status().isBadRequest());

        // Reopen disease to verify addTreatment upper-bound validation
        mvc.perform(put(base + "/" + diseaseId)
                        .with(user("owner@farm.test").authorities(() -> "ROLE_FARM_OWNER"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of("status", "ACTIVE"))))
                .andExpect(status().isOk());

        mvc.perform(post(base + "/" + diseaseId + "/treatments")
                        .with(user("owner@farm.test").authorities(() -> "ROLE_FARM_OWNER"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of(
                                "treatmentDate", today.toString(),
                                "inventoryItemId", lot1.getId(),
                                "stockQuantity", new BigDecimal("100000000000000")
                        ))))
                .andExpect(status().isBadRequest());

        mvc.perform(post(base + "/" + diseaseId + "/treatments")
                        .with(user("owner@farm.test").authorities(() -> "ROLE_FARM_OWNER"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of(
                                "treatmentDate", today.toString(),
                                "medicineName", "Thuốc tràn số",
                                "manualCost", new BigDecimal("100000000000000")
                        ))))
                .andExpect(status().isBadRequest());

        // CycleExpenseRequest direct endpoint also rejects > NUMERIC(16,2) with 400 Bad Request
        mvc.perform(post("/api/cycles/" + cycle.getId() + "/expenses")
                        .with(user("acc@farm.test").authorities(() -> "ROLE_ACCOUNTANT"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of(
                                "expenseDate", today.toString(),
                                "category", "MEDICINE",
                                "amount", new BigDecimal("100000000000000"),
                                "note", "Tràn số"
                        ))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void concurrentUpdateTreatmentCostSerializesWithoutDuplicateCycleExpense() throws Exception {
        var txNew = new org.springframework.transaction.support.TransactionTemplate(txManager);
        txNew.setPropagationBehavior(org.springframework.transaction.TransactionDefinition.PROPAGATION_REQUIRES_NEW);

        Long[] ids = txNew.execute(status -> {
            FarmArea a = new FarmArea();
            a.setName("Khu Concurrency Cost");
            a.setNameKey("khu concurrency cost");
            a = areaRepository.saveAndFlush(a);

            Barn b = new Barn();
            b.setArea(a);
            b.setName("Chuồng Concurrency");
            b.setNameKey("chuồng concurrency");
            b.setCapacity(500);
            b.setStatus(BarnStatus.ACTIVE);
            b = barnRepository.saveAndFlush(b);

            FarmingCycle c = new FarmingCycle();
            c.setBarn(b);
            c.setCycleNumber(1);
            c.setStartDate(today.minusDays(5));
            c.setStatus(CycleStatus.ACTIVE);
            c = cycleRepository.saveAndFlush(c);

            CycleDisease d = new CycleDisease();
            d.setCycle(c);
            d.setDiseaseName("CRD Concurrency");
            d.setStartDate(today.minusDays(2));
            d.setStatus(DiseaseStatus.ACTIVE);
            d = diseaseRepository.saveAndFlush(d);

            DiseaseTreatmentLog t = new DiseaseTreatmentLog();
            t.setDisease(d);
            t.setTreatmentDate(today.minusDays(1));
            t.setMedicineName("Tylosin mua lẻ");
            t.setCost(BigDecimal.ZERO);
            t = treatmentLogRepository.saveAndFlush(t);

            return new Long[]{a.getId(), b.getId(), c.getId(), d.getId(), t.getId()};
        });

        Long areaId = ids[0], barnId = ids[1], concCycleId = ids[2], concDiseaseId = ids[3], concTreatId = ids[4];
        java.util.concurrent.ExecutorService pool = java.util.concurrent.Executors.newFixedThreadPool(2);
        try {
            var ready = new java.util.concurrent.CountDownLatch(2);
            var start = new java.util.concurrent.CountDownLatch(1);

            var f1 = pool.submit(() -> {
                ready.countDown();
                start.await();
                return cycleDiseaseService.updateTreatmentCost(
                        concCycleId, concDiseaseId, concTreatId,
                        new com.farmshift.backendFarmShift.dto.request.DiseaseTreatmentCostRequest(new BigDecimal("150000")),
                        "acc@farm.test");
            });
            var f2 = pool.submit(() -> {
                ready.countDown();
                start.await();
                return cycleDiseaseService.updateTreatmentCost(
                        concCycleId, concDiseaseId, concTreatId,
                        new com.farmshift.backendFarmShift.dto.request.DiseaseTreatmentCostRequest(new BigDecimal("180000")),
                        "owner@farm.test");
            });

            ready.await();
            start.countDown();
            f1.get();
            f2.get();

            txNew.executeWithoutResult(status -> {
                List<CycleExpense> expenses = expenseRepository.findAllByCycleIdOrderByExpenseDateDescIdDesc(concCycleId);
                DiseaseTreatmentLog refreshed = treatmentLogRepository.findById(concTreatId).orElseThrow();
                assertThat(expenses).hasSize(1);
                assertThat(refreshed.getExpense()).isNotNull();
                assertThat(expenses.getFirst().getId()).isEqualTo(refreshed.getExpense().getId());
                assertThat(expenses.getFirst().getAmount()).isEqualByComparingTo(refreshed.getCost());
                assertThat(refreshed.getCost()).isIn(new BigDecimal("150000.00"), new BigDecimal("180000.00"),
                        new BigDecimal("150000"), new BigDecimal("180000"));
            });
        } finally {
            pool.shutdownNow();
            txNew.executeWithoutResult(status -> {
                treatmentLogRepository.findById(concTreatId).ifPresent(t -> {
                    t.setExpense(null);
                    treatmentLogRepository.saveAndFlush(t);
                    treatmentLogRepository.delete(t);
                    treatmentLogRepository.flush();
                });
                expenseRepository.deleteAll(expenseRepository.findAllByCycleIdOrderByExpenseDateDescIdDesc(concCycleId));
                expenseRepository.flush();
                diseaseRepository.deleteById(concDiseaseId);
                cycleRepository.deleteById(concCycleId);
                barnRepository.deleteById(barnId);
                areaRepository.deleteById(areaId);
            });
        }
    }
}
