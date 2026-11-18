package com.farmshift.backendFarmShift;

import com.farmshift.backendFarmShift.dto.response.BarnResponsibilities;
import com.farmshift.backendFarmShift.entity.*;
import com.farmshift.backendFarmShift.exception.ConflictException;
import com.farmshift.backendFarmShift.repository.*;
import com.farmshift.backendFarmShift.security.RoleNames;
import com.farmshift.backendFarmShift.service.BarnResponsibilityService;
import com.farmshift.backendFarmShift.service.CycleService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
@ActiveProfiles("test")
@Transactional
class BarnResponsibilityServiceTest {

    @Autowired private BarnResponsibilityService service;
    @Autowired private FarmAreaRepository areaRepository;
    @Autowired private BarnRepository barnRepository;
    @Autowired private WarehouseCategoryRepository warehouseRepository;
    @Autowired private AccountRepository accountRepository;
    @Autowired private RoleRepository roleRepository;
    @Autowired private WorkTaskRepository workTaskRepository;
    @Autowired private BarnWorkerRepository barnWorkerRepository;
    @Autowired private EntityManager entityManager;
    @Autowired private EntityManagerFactory entityManagerFactory;

    private Role workerRole;
    private Account workerA;
    private Account workerB;

    @BeforeEach
    void setUp() {
        workTaskRepository.deleteAll();
        barnWorkerRepository.deleteAll();
        barnRepository.deleteAll();
        warehouseRepository.deleteAll();
        areaRepository.deleteAll();

        workerRole = roleRepository.findByName(RoleNames.FARM_WORKER)
                .orElseGet(() -> roleRepository.save(new Role(null, RoleNames.FARM_WORKER, "Công nhân")));

        workerA = saveWorker("brs.worker.a." + UUID.randomUUID().toString().substring(0, 6) + "@farm.test", "Công nhân A");
        workerB = saveWorker("brs.worker.b." + UUID.randomUUID().toString().substring(0, 6) + "@farm.test", "Công nhân B");
    }

    private Account saveWorker(String email, String fullName) {
        Account a = new Account();
        a.setEmail(email);
        a.setPassword("$2a$10$dummy");
        a.setFullName(fullName);
        a.setRole(workerRole);
        a.setIsActive(true);
        return accountRepository.save(a);
    }

    @Test
    void settings_ResolvesLegacyAndManyToManySharedWarehousesInConstantQueries() {
        WarehouseCategory sharedFeed = new WarehouseCategory();
        sharedFeed.setName("Kho Cám Chung");
        sharedFeed.setNameKey("kho cam chung " + UUID.randomUUID());
        sharedFeed.setKind("FEED");
        sharedFeed = warehouseRepository.save(sharedFeed);

        for (int i = 1; i <= 5; i++) {
            FarmArea area = new FarmArea();
            area.setName("Khu " + i);
            area.setNameKey("khu-" + i + "-" + UUID.randomUUID());
            area.getWorkers().add(i % 2 == 0 ? workerA : workerB);
            area.getWarehouses().add(sharedFeed);
            area = areaRepository.save(area);

            if (i == 1) {
                WarehouseCategory legacyMed = new WarehouseCategory();
                legacyMed.setName("Kho Thuốc Riêng 1");
                legacyMed.setNameKey("kho thuoc rieng 1 " + UUID.randomUUID());
                legacyMed.setKind("MEDICINE");
                legacyMed.setArea(area);
                warehouseRepository.save(legacyMed);
            }

            Barn barn = new Barn();
            barn.setArea(area);
            barn.setName("Chuồng " + i + "A");
            barn.setNameKey("chuong-" + i + "a-" + UUID.randomUUID());
            barn.setStatus(BarnStatus.ACTIVE);
            barn.setCapacity(1000);
            barn.setCurrentQuantity(0);
            barn.setWorkersOverride(false);
            barnRepository.save(barn);
        }

        entityManager.flush();
        entityManager.clear();

        Statistics stats = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        stats.setStatisticsEnabled(true);
        stats.clear();

        BarnResponsibilities result = service.settings();

        long sqlCount = stats.getPrepareStatementCount();
        assertEquals(5, result.areas().size());
        assertTrue(sqlCount <= 8,
                "Expected bounded batch queries without N+1 across 5 areas, got SQL count=" + sqlCount);

        BarnResponsibilities.Area firstArea = result.areas().getFirst();
        assertEquals(2, firstArea.warehouses().size(), "Area 1 must include both shared M2M warehouse and legacy area_id warehouse");
        assertTrue(firstArea.warehouses().stream().anyMatch(w -> "Kho Cám Chung".equals(w.name())));
        assertTrue(firstArea.warehouses().stream().anyMatch(w -> "Kho Thuốc Riêng 1".equals(w.name())));
        assertEquals(1, firstArea.workers().size());

        BarnResponsibilities.Area secondArea = result.areas().get(1);
        assertEquals(1, secondArea.warehouses().size(), "Area 2 must see shared M2M warehouse");
        assertEquals("Kho Cám Chung", secondArea.warehouses().getFirst().name());
    }

    @Test
    void guardRemoval_UsesVietnamTimezoneForOpenTaskCheck() {
        FarmArea area = new FarmArea();
        area.setName("Khu Timezone");
        area.setNameKey("khu-tz-" + UUID.randomUUID());
        area.getWorkers().add(workerA);
        area = areaRepository.save(area);

        Barn barn = new Barn();
        barn.setArea(area);
        barn.setName("Chuồng TZ");
        barn.setNameKey("chuong-tz-" + UUID.randomUUID());
        barn.setStatus(BarnStatus.ACTIVE);
        barn.setCapacity(500);
        barn.setCurrentQuantity(0);
        barn.setWorkersOverride(false);
        barn = barnRepository.save(barn);

        LocalDate todayVn = LocalDate.now(CycleService.VN_ZONE);

        WorkTask pastTask = new WorkTask();
        pastTask.setBarn(barn);
        pastTask.setAssignee(workerA);
        pastTask.setTitle("Việc đã qua");
        pastTask.setStartDate(todayVn.minusDays(2));
        pastTask.setEndDate(todayVn.minusDays(1));
        workTaskRepository.save(pastTask);

        // Past task ended yesterday in VN_ZONE: worker removal succeeds
        final Long areaId = area.getId();
        assertDoesNotThrow(() -> service.setArea(areaId, List.of()));

        // Re-assign worker and add task ending today in VN_ZONE: worker removal is blocked
        service.setArea(areaId, List.of(workerA.getId()));
        WorkTask todayTask = new WorkTask();
        todayTask.setBarn(barn);
        todayTask.setAssignee(workerA);
        todayTask.setTitle("Việc hôm nay");
        todayTask.setStartDate(todayVn);
        todayTask.setEndDate(todayVn);
        workTaskRepository.save(todayTask);

        assertThrows(ConflictException.class, () -> service.setArea(areaId, List.of()));
    }
}
