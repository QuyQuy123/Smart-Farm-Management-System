package com.farmshift.backendFarmShift;

import com.farmshift.backendFarmShift.entity.*;
import com.farmshift.backendFarmShift.repository.*;
import com.farmshift.backendFarmShift.security.RoleNames;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class WorkerTaskStockDeductionTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired FarmAreaRepository areaRepository;
    @Autowired BarnRepository barnRepository;
    @Autowired AccountRepository accountRepository;
    @Autowired RoleRepository roleRepository;
    @Autowired WarehouseCategoryRepository warehouseRepository;
    @Autowired InventoryItemRepository inventoryRepository;

    private long id(ResultActions result) throws Exception {
        String body = result.andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return mapper.readTree(body).path("data").path("id").asLong();
    }

    @Test
    void testWorkerAssignedToAreaOrBarn_AutomaticallyDeductsFromAreaWarehouseWithoutManualWarehouseRole() throws Exception {
        // 1. Tạo Khu nuôi Khu 1 (tự động sinh Kho cám Khu 1)
        var areaRes = mvc.perform(post("/api/farm-areas").with(user("owner").authorities(() -> "ROLE_FARM_OWNER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of("name", "Khu Tự Động Kho"))));
        long areaId = id(areaRes);

        WarehouseCategory feedWh = warehouseRepository.findAllByArea_Id(areaId).stream()
                .filter(w -> "FEED".equals(w.getKind())).findFirst().orElseThrow();

        // 2. Tạo chuồng Nhà A1 thuộc Khu 1
        long barnId = id(mvc.perform(post("/api/barns").with(user("owner").authorities(() -> "ROLE_FARM_OWNER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of("areaId", areaId, "name", "Nhà A1", "capacity", 5000, "areaM2", 400)))));

        // 3. Tạo tài khoản Công nhân
        Role workerRole = roleRepository.findByName(RoleNames.FARM_WORKER).orElseGet(() -> roleRepository.save(new Role(null, RoleNames.FARM_WORKER, RoleNames.FARM_WORKER)));
        Account worker = new Account();
        worker.setEmail("worker.autoflow@smartfarm.com");
        worker.setFullName("Lê Văn Công Nhân");
        worker.setPassword("123456");
        worker.setRole(workerRole);
        worker.setIsActive(true);
        worker = accountRepository.saveAndFlush(worker);

        // 4. Phân công công nhân vào Khu nuôi (không phân công theo kho!)
        mvc.perform(put("/api/areas/" + areaId + "/workers").with(user("owner").authorities(() -> "ROLE_FARM_OWNER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of("workerIds", List.of(worker.getId())))))
                .andExpect(status().isOk());

        // Kiểm tra kho KHÔNG hề có thủ công worker trong warehouse_workers
        WarehouseCategory rawWh = warehouseRepository.findById(feedWh.getId()).orElseThrow();
        assertTrue(rawWh.getWorkers().isEmpty(), "Không gán công nhân thủ công vào warehouse_workers");

        // 5. Chuẩn bị hàng tồn kho cám trong Kho cám Khu 1
        long bag = id(mvc.perform(post("/api/measurement-units").with(user("owner").authorities(() -> "ROLE_FARM_OWNER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of("code", "BAO25AUTO", "name", "Bao 25kg Auto", "contentQuantity", 25, "contentUnit", "KG")))));
        long feed = id(mvc.perform(post("/api/inventory-items").with(user("owner").authorities(() -> "ROLE_FARM_OWNER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of("warehouseId", feedWh.getId(), "name", "Cám Con Cò 01", "unitId", bag, "price", 350000)))));
        InventoryItem item = inventoryRepository.findById(feed).orElseThrow();
        item.setStock(BigDecimal.valueOf(100)); // 100 bao
        inventoryRepository.saveAndFlush(item);

        // 6. Tạo Chương trình nuôi, Lứa nuôi và Đàn gà
        long progId = id(mvc.perform(post("/api/farming-programs").with(user("owner").authorities(() -> "ROLE_FARM_OWNER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of("name", "Gà Thử Nghiệm", "breed", "Gà Thử Nghiệm", "durationDays", 90,
                        "steps", List.of(Map.of("category", "FEED", "name", "Cám Con Cò 01", "dayFrom", 1, "dayTo", 30, "quantity", 50, "mealsPerDay", 1)))))));

        long cycleId = id(mvc.perform(post("/api/barns/" + barnId + "/cycles").with(user("owner").authorities(() -> "ROLE_FARM_OWNER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of("startDate", LocalDate.now().toString())))));

        id(mvc.perform(post("/api/cycles/" + cycleId + "/flocks").with(user("owner").authorities(() -> "ROLE_FARM_OWNER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of("name", "Đàn gà 01", "programId", progId, "gender", "MIXED",
                        "importDate", LocalDate.now().toString(), "ageAtImport", 1, "quantity", 1000, "avgWeight", 0.04, "unitPrice", 12000)))));

        // 7. Công nhân xem phiếu việc: kho nguồn tự động nhận là Kho cám của Khu
        var planRes = mvc.perform(get("/api/cycles/" + cycleId + "/daily-plan")
                .with(user(worker.getEmail()).authorities(() -> RoleNames.FARM_WORKER)))
                .andExpect(status().isOk())
                .andReturn();

        String planJson = planRes.getResponse().getContentAsString();
        assertTrue(planJson.contains("Kho cám Tự Động Kho"), "Phiếu việc phải tự động trỏ đến Kho cám của Khu");

        String taskKey = mapper.readTree(planJson).path("data").path("tasks").get(0).path("key").asText();

        // 8. Công nhân bấm Xong -> Tự động trừ kho thành công
        mvc.perform(post("/api/cycles/" + cycleId + "/daily-plan/tasks")
                .with(user(worker.getEmail()).authorities(() -> RoleNames.FARM_WORKER))
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of(
                        "date", LocalDate.now().toString(),
                        "taskKey", taskKey
                ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.doneCount").value(1));

        // Kiểm tra tồn kho đã bị trừ (50kg = 2 bao -> còn 98 bao)
        InventoryItem updatedItem = inventoryRepository.findById(feed).orElseThrow();
        assertThat(updatedItem.getStock()).isEqualByComparingTo("98");
    }
}

