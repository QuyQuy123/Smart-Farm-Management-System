package com.farmshift.backendFarmShift;

import com.farmshift.backendFarmShift.dto.request.BarnWorkersRequest;
import com.farmshift.backendFarmShift.entity.*;
import com.farmshift.backendFarmShift.repository.*;
import com.farmshift.backendFarmShift.security.RoleNames;
import com.farmshift.backendFarmShift.service.AreaWarehouseService;
import com.farmshift.backendFarmShift.service.CycleService;
import com.farmshift.backendFarmShift.service.WorkAssignmentService;
import com.farmshift.backendFarmShift.service.ai.AiRateLimiter;
import com.farmshift.backendFarmShift.service.ai.AiSecurityGuard;
import com.farmshift.backendFarmShift.service.ai.FarmKnowledgeRagService;
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
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@WithMockUser(username = "owner@farm.test", authorities = "ROLE_FARM_OWNER")
class Stage3HybridRagAndDynamicRetrievalTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired BarnRepository barnRepository;
    @Autowired WarehouseCategoryRepository warehouseRepository;
    @Autowired ProductCategoryRepository productRepository;
    @Autowired InventoryItemRepository inventoryRepository;
    @Autowired MeasurementUnitRepository unitRepository;
    @Autowired BrandRepository brandRepository;
    @Autowired AccountRepository accountRepository;
    @Autowired RoleRepository roleRepository;
    @Autowired WorkAssignmentService workAssignmentService;
    @Autowired AiSecurityGuard aiSecurityGuard;
    @Autowired FarmKnowledgeRagService ragService;
    @Autowired AiRateLimiter rateLimiter;

    private Barn barnA1;
    private WarehouseCategory areaAFeedWarehouse;
    private WarehouseCategory areaBFeedWarehouse;

    @BeforeEach
    void setUp() throws Exception {
        rateLimiter.resetAll();
        aiSecurityGuard.evictContextCache();

        long areaA = id(postJson("/api/farm-areas", Map.of("name", "Khu RAG A")));
        long areaB = id(postJson("/api/farm-areas", Map.of("name", "Khu RAG B")));
        long barnA1Id = id(postJson("/api/barns", Map.of("areaId", areaA, "name", "Nhà A1", "capacity", 5000, "areaM2", 450)));
        barnA1 = barnRepository.findById(barnA1Id).orElseThrow();

        long progId = id(postJson("/api/farming-programs", Map.of(
                "name", "Quy trình J-Dabaco RAG",
                "breed", "J-Dabaco",
                "durationDays", 70,
                "steps", List.of(
                        Map.of("category", "FEED", "name", "Higro 01", "dayFrom", 1, "dayTo", 21, "quantity", 25, "mealsPerDay", 4),
                        Map.of("category", "VACCINE", "name", "Nhỏ vắc-xin Gumboro lần 1 (cắt nước 1.5h)", "dayFrom", 10, "dayTo", 14, "quantity", 1000, "unit", "liều", "method", "DRINKING_WATER")
                )
        )));

        LocalDate start = LocalDate.now(CycleService.VN_ZONE).minusDays(11);
        long cycleId = id(postJson("/api/barns/" + barnA1Id + "/cycles", Map.of("startDate", start.toString())));
        id(postJson("/api/cycles/" + cycleId + "/flocks", Map.of(
                "name", "Đàn RAG A1",
                "programId", progId,
                "gender", "MALE",
                "importDate", start.toString(),
                "ageAtImport", 1,
                "quantity", 2000,
                "avgWeight", 0.04,
                "unitPrice", 11000,
                "sourceNote", "Dabaco"
        )));

        areaAFeedWarehouse = warehouseRepository.findAllByArea_Id(areaA).stream()
                .filter(w -> AreaWarehouseService.FEED.equalsIgnoreCase(w.getKind()))
                .findFirst().orElseThrow();
        areaBFeedWarehouse = warehouseRepository.findAllByArea_Id(areaB).stream()
                .filter(w -> AreaWarehouseService.FEED.equalsIgnoreCase(w.getKind()))
                .findFirst().orElseThrow();
    }

    @Test
    void testDynamicInventoryRetrievalFindsItemBeyond25LimitAndPreservesWorkerRbac() {
        MeasurementUnit unit = new MeasurementUnit();
        unit.setCode("GOI_TEST");
        unit.setCodeKey("goi_test");
        unit.setName("Gói");
        unit.setNameKey("goi");
        unit = unitRepository.saveAndFlush(unit);

        Brand brand = new Brand();
        brand.setName("FAVET Test");
        brand.setNameKey("favet-test-key");
        brand.setProductType("Thuốc thú y");
        brand = brandRepository.saveAndFlush(brand);

        // Insert 30 filler inventory items first
        for (int idx = 1; idx <= 30; idx++) {
            ProductCategory p = new ProductCategory();
            p.setName("Vật tư phụ trợ số " + idx);
            p.setNameKey("vat tu phu tro so " + idx);
            p.setWarehouse(areaAFeedWarehouse);
            p = productRepository.saveAndFlush(p);

            InventoryItem item = new InventoryItem();
            item.setProduct(p);
            item.setWarehouse(areaAFeedWarehouse);
            item.setBrand(brand);
            item.setUnit(unit);
            item.setStock(new BigDecimal("10.000000"));
            item.setPrice(new BigDecimal("100000.00"));
            inventoryRepository.saveAndFlush(item);
        }

        // Insert target 31st item beyond old .limit(25)
        ProductCategory targetProd = new ProductCategory();
        targetProd.setName("Thuốc Đặc Trị Toltrazuril 999");
        targetProd.setNameKey("thuoc dac tri toltrazuril 999");
        targetProd.setWarehouse(areaAFeedWarehouse);
        targetProd = productRepository.saveAndFlush(targetProd);

        InventoryItem targetItem = new InventoryItem();
        targetItem.setProduct(targetProd);
        targetItem.setWarehouse(areaAFeedWarehouse);
        targetItem.setBrand(brand);
        targetItem.setUnit(unit);
        targetItem.setStock(new BigDecimal("12.000000"));
        targetItem.setPrice(new BigDecimal("350000.00"));
        inventoryRepository.saveAndFlush(targetItem);

        // Insert secret item in unassigned Area B
        ProductCategory secretProd = new ProductCategory();
        secretProd.setName("Thuốc Bí Mật Khu B");
        secretProd.setNameKey("thuoc bi mat khu b");
        secretProd.setWarehouse(areaBFeedWarehouse);
        secretProd = productRepository.saveAndFlush(secretProd);

        InventoryItem secretItem = new InventoryItem();
        secretItem.setProduct(secretProd);
        secretItem.setWarehouse(areaBFeedWarehouse);
        secretItem.setBrand(brand);
        secretItem.setUnit(unit);
        secretItem.setStock(new BigDecimal("99.000000"));
        secretItem.setPrice(new BigDecimal("999000.00"));
        inventoryRepository.saveAndFlush(secretItem);

        aiSecurityGuard.evictContextCache();

        String ownerCtx = aiSecurityGuard.buildSanitizedLlmContext(
                "owner@farm.test", false, "/inventory", null,
                "Kiểm tra tồn kho Thuốc Đặc Trị Toltrazuril 999"
        );
        assertTrue(ownerCtx.contains("Thuốc Đặc Trị Toltrazuril 999"),
                "Dynamic retrieval must find relevant 31st item beyond old .limit(25): " + ownerCtx);
        assertTrue(ownerCtx.contains("truy xuất động 25/"), "Should indicate dynamic retrieval coverage");

        // Verify worker RBAC: assign worker to barnA1 only
        Role workerRole = roleRepository.findByName(RoleNames.FARM_WORKER).orElseGet(() -> {
            Role role = new Role();
            role.setName(RoleNames.FARM_WORKER);
            return roleRepository.saveAndFlush(role);
        });
        Account worker = new Account();
        worker.setEmail("worker-rag@farm.test");
        worker.setPassword("bcrypt-stub");
        worker.setFullName("Công nhân RAG");
        worker.setRole(workerRole);
        worker.setIsActive(true);
        worker = accountRepository.saveAndFlush(worker);
        workAssignmentService.setBarnWorkers(barnA1.getId(), new BarnWorkersRequest(List.of(worker.getId())), "owner@farm.test");

        aiSecurityGuard.evictContextCache();
        String workerCtx = aiSecurityGuard.buildSanitizedLlmContext(
                "worker-rag@farm.test", true, "/barns/" + barnA1.getId(), null,
                "Kiểm tra Toltrazuril 999 và Thuốc Bí Mật Khu B"
        );
        assertTrue(workerCtx.contains("Thuốc Đặc Trị Toltrazuril 999"));
        assertFalse(workerCtx.contains("Thuốc Bí Mật Khu B"), "Worker must NOT see unassigned area stock");
        assertFalse(workerCtx.contains("350000"), "Worker must NOT see item price");
    }

    @Test
    void testHybridRagRetrievesVetKnowledgeAndFarmingProgramStepsInPromptAndOfflineFallback() throws Exception {
        // 1. Direct Hybrid RAG retrieval checks both static poultry vet corpus & live farming_program_steps
        List<FarmKnowledgeRagService.RagHit> hits = ragService.retrieveHybrid(
                "Lịch nhỏ vắc-xin Gumboro lần 1 cho đàn J-Dabaco ngày tuổi 12",
                12,
                null,
                false,
                5
        );
        assertFalse(hits.isEmpty());
        assertTrue(hits.stream().anyMatch(h -> "PROGRAM_STEP".equals(h.document().sourceType())
                && h.document().title().contains("Gumboro")), "Must retrieve live farming_program_steps");
        assertTrue(hits.stream().anyMatch(h -> "VET_DOC".equals(h.document().sourceType())),
                "Must also retrieve curated veterinary knowledge doc");

        // 2. Context injection into LLM prompt
        String vetCtx = aiSecurityGuard.buildSanitizedLlmContext(
                "owner@farm.test", false, "/barns/" + barnA1.getId(), null,
                "Gà đi ngoài phân sáp nâu lẫn máu nghi cầu trùng thì xử lý thế nào?"
        );
        assertTrue(vetCtx.contains("<retrieved_knowledge>"), "Must inject <retrieved_knowledge> RAG block");
        assertTrue(vetCtx.contains("Toltrazuril"), "Must include Coccidiosis treatment knowledge");

        // 3. Offline / fallback response via /api/ai/assistant uses grounded Hybrid RAG + MSG38 disclaimer
        mvc.perform(post("/api/ai/assistant")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of(
                                "message", "Đàn gà J-Dabaco bị sưng phù đầu Coryza chảy nước mũi hôi thì xử lý thế nào?",
                                "currentRoute", "/barns/" + barnA1.getId()
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.actionType").value("VET_DIAGNOSIS"))
                .andExpect(jsonPath("$.reply").value(org.hamcrest.Matchers.containsString("Coryza")))
                .andExpect(jsonPath("$.reply").value(org.hamcrest.Matchers.containsString("MSG38")));

        // 4. Live farming_program_steps are NOT shadowed by static fallback vaccine strings
        mvc.perform(post("/api/ai/assistant")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of(
                                "message", "Lịch nhỏ vắc-xin Gumboro lần 1 cho đàn J-Dabaco ở Nhà A1?",
                                "currentRoute", "/barns/" + barnA1.getId()
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.actionType").value("GENERAL_QNA"))
                .andExpect(jsonPath("$.reply").value(org.hamcrest.Matchers.containsString("Gumboro")));
    }

    private ResultActions postJson(String url, Object body) throws Exception {
        return mvc.perform(post(url)
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
