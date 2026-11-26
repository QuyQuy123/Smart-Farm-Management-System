package com.farmshift.backendFarmShift;

import com.farmshift.backendFarmShift.entity.*;
import com.farmshift.backendFarmShift.repository.*;
import com.farmshift.backendFarmShift.service.CycleService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class CycleHistoryIntegrationTest {

    @Autowired MockMvc mvc;
    @Autowired FarmAreaRepository areaRepository;
    @Autowired BarnRepository barnRepository;
    @Autowired FarmingCycleRepository cycleRepository;
    @Autowired FlockRepository flockRepository;
    @Autowired FlockMovementRepository movementRepository;
    @Autowired FeedRecordRepository feedRepository;
    @Autowired CycleExpenseRepository expenseRepository;
    @Autowired CycleDiseaseRepository diseaseRepository;
    @Autowired DiseaseTreatmentLogRepository treatmentRepository;
    @Autowired FarmingProgramRepository programRepository;
    @Autowired AccountRepository accountRepository;
    @Autowired RoleRepository roleRepository;

    private FarmArea areaA, areaB;
    private Barn barnA1, barnB1;
    private FarmingCycle closedA, closedB, activeA;
    private FarmingProgram programA;
    private LocalDate today;

    @BeforeEach
    void setUp() {
        today = LocalDate.now(CycleService.VN_ZONE);

        Role workerRole = roleRepository.findByName("ROLE_FARM_WORKER").orElseGet(() -> {
            Role r = new Role();
            r.setName("ROLE_FARM_WORKER");
            return roleRepository.save(r);
        });

        Account workerA = new Account();
        workerA.setEmail("worker.a@farm.test");
        workerA.setFullName("Công nhân Khu A");
        workerA.setPassword("secret");
        workerA.setRole(workerRole);
        workerA.setIsActive(true);
        workerA = accountRepository.save(workerA);

        areaA = new FarmArea();
        areaA.setName("Khu Lịch Sử A");
        areaA.setNameKey("khu lịch sử a");
        areaA.getWorkers().add(workerA);
        areaA = areaRepository.save(areaA);

        areaB = new FarmArea();
        areaB.setName("Khu Lịch Sử B");
        areaB.setNameKey("khu lịch sử b");
        areaB = areaRepository.save(areaB);

        barnA1 = new Barn();
        barnA1.setArea(areaA);
        barnA1.setName("Chuồng A1");
        barnA1.setNameKey("chuồng a1");
        barnA1.setCapacity(1000);
        barnA1.setStatus(BarnStatus.INACTIVE);
        barnA1 = barnRepository.save(barnA1);

        barnB1 = new Barn();
        barnB1.setArea(areaB);
        barnB1.setName("Chuồng B1");
        barnB1.setNameKey("chuồng b1");
        barnB1.setCapacity(1000);
        barnB1.setStatus(BarnStatus.INACTIVE);
        barnB1 = barnRepository.save(barnB1);

        programA = new FarmingProgram();
        programA.setName("CT Gà Mía 90 ngày");
        programA.setNameKey("ct gà mía 90 ngày");
        programA.setBreed("Gà Mía");
        programA.setDurationDays(90);
        programA = programRepository.save(programA);

        // Closed cycle in Area A (with disease & treatment cost)
        closedA = new FarmingCycle();
        closedA.setBarn(barnA1);
        closedA.setCycleNumber(1);
        closedA.setStartDate(today.minusDays(95));
        closedA.setEndDate(today.minusDays(5));
        closedA.setStatus(CycleStatus.CLOSED);
        closedA = cycleRepository.save(closedA);

        Flock flockA = new Flock();
        flockA.setCycle(closedA);
        flockA.setName("Đàn A1");
        flockA.setGender(FlockGender.MIXED);
        flockA.setSourceType(FlockSource.PURCHASE);
        flockA.setImportDate(today.minusDays(95));
        flockA.setAgeAtImport(1);
        flockA.setImportQuantity(100);
        flockA.setImportAvgWeight(new BigDecimal("0.050"));
        flockA.setUnitPrice(new BigDecimal("15000.00")); // 1,500,000 VND
        flockA.setQuantity(0);
        flockA.setStatus(FlockStatus.ARCHIVED);
        flockA.setProgram(programA);
        flockA = flockRepository.save(flockA);

        FlockMovement imp = new FlockMovement();
        imp.setFlock(flockA);
        imp.setType(FlockMovementType.IMPORT);
        imp.setMovementDate(today.minusDays(95));
        imp.setQuantity(100);
        imp.setWeightKg(new BigDecimal("5.00"));
        movementRepository.save(imp);

        FlockMovement death = new FlockMovement();
        death.setFlock(flockA);
        death.setType(FlockMovementType.DEATH);
        death.setMovementDate(today.minusDays(40));
        death.setQuantity(5);
        movementRepository.save(death);

        FlockMovement harvest = new FlockMovement();
        harvest.setFlock(flockA);
        harvest.setType(FlockMovementType.HARVEST);
        harvest.setMovementDate(today.minusDays(5));
        harvest.setQuantity(95);
        harvest.setWeightKg(new BigDecimal("190.00")); // 2.000 kg avg
        harvest.setUnitPrice(new BigDecimal("80000.00")); // 15,200,000 revenue
        movementRepository.save(harvest);

        FeedRecord feed = new FeedRecord();
        feed.setCycle(closedA);
        feed.setRecordDate(today.minusDays(30));
        feed.setFeedName("Cám phát triển");
        feed.setQuantityKg(new BigDecimal("370.000")); // FCR = 370 / (190 - 5) = 2.00
        feed.setUnitPrice(new BigDecimal("10000.00")); // 3,700,000 feed cost
        feedRepository.save(feed);

        CycleExpense medExpense = new CycleExpense();
        medExpense.setCycle(closedA);
        medExpense.setExpenseDate(today.minusDays(50));
        medExpense.setCategory(ExpenseCategory.MEDICINE);
        medExpense.setAmount(new BigDecimal("300000.00"));
        medExpense = expenseRepository.save(medExpense);

        CycleDisease disease = new CycleDisease();
        disease.setCycle(closedA);
        disease.setDiseaseName("Cầu trùng");
        disease.setStartDate(today.minusDays(52));
        disease.setEndDate(today.minusDays(48));
        disease.setStatus(DiseaseStatus.RECOVERED);
        disease = diseaseRepository.save(disease);

        DiseaseTreatmentLog tlog = new DiseaseTreatmentLog();
        tlog.setDisease(disease);
        tlog.setTreatmentDate(today.minusDays(50));
        tlog.setMedicineName("Baycox");
        tlog.setCost(new BigDecimal("300000.00"));
        tlog.setExpense(medExpense);
        treatmentRepository.save(tlog);

        // Closed cycle in Area B (earlier endDate)
        closedB = new FarmingCycle();
        closedB.setBarn(barnB1);
        closedB.setCycleNumber(1);
        closedB.setStartDate(today.minusDays(150));
        closedB.setEndDate(today.minusDays(60));
        closedB.setStatus(CycleStatus.CLOSED);
        closedB = cycleRepository.save(closedB);

        // Active cycle (must NOT appear in closed history)
        activeA = new FarmingCycle();
        activeA.setBarn(barnA1);
        activeA.setCycleNumber(2);
        activeA.setStartDate(today.minusDays(2));
        activeA.setStatus(CycleStatus.ACTIVE);
        activeA = cycleRepository.save(activeA);
    }

    @Test
    @WithMockUser(username = "owner@farm.test", authorities = "ROLE_FARM_OWNER")
    void returnsClosedCyclesWithAccurateKpisDiseaseMetricsAndFilters() throws Exception {
        // TotalCost = 1,500,000 (chicks) + 3,700,000 (feed) + 300,000 (medicine) = 5,500,000
        // Revenue = 15,200,000 -> Profit = 9,700,000; FCR = 370 / 185 = 2.00; Survival = 95.00%
        mvc.perform(get("/api/cycles/history"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].cycleId").value(closedA.getId()))
                .andExpect(jsonPath("$.data[0].fcr").value(2.0))
                .andExpect(jsonPath("$.data[0].survivalRate").value(95.0))
                .andExpect(jsonPath("$.data[0].avgHarvestWeightKg").value(2.0))
                .andExpect(jsonPath("$.data[0].diseaseCount").value(1))
                .andExpect(jsonPath("$.data[0].totalDiseaseMedicineCost").value(300000))
                .andExpect(jsonPath("$.data[0].totalCost").value(5500000))
                .andExpect(jsonPath("$.data[0].revenue").value(15200000))
                .andExpect(jsonPath("$.data[0].profit").value(9700000));

        // Filter by areaId, from/to, programId, search
        mvc.perform(get("/api/cycles/history").param("areaId", String.valueOf(areaB.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].cycleId").value(closedB.getId()));

        mvc.perform(get("/api/cycles/history")
                        .param("from", today.minusDays(10).toString())
                        .param("to", today.toString())
                        .param("programId", String.valueOf(programA.getId()))
                        .param("search", "Gà Mía"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].cycleId").value(closedA.getId()));
    }

    @Test
    void workerOnlySeesAssignedBarnClosedCyclesAndAllFinancialFieldsAreNull() throws Exception {
        mvc.perform(get("/api/cycles/history")
                        .with(user("worker.a@farm.test").authorities(() -> "ROLE_FARM_WORKER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].cycleId").value(closedA.getId()))
                .andExpect(jsonPath("$.data[0].diseaseCount").value(1))
                .andExpect(jsonPath("$.data[0].totalDiseaseMedicineCost").doesNotExist())
                .andExpect(jsonPath("$.data[0].totalCost").doesNotExist())
                .andExpect(jsonPath("$.data[0].revenue").doesNotExist())
                .andExpect(jsonPath("$.data[0].profit").doesNotExist())
                .andExpect(jsonPath("$.data[0].costPerKg").doesNotExist());
    }
}
