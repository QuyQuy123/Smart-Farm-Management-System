package com.farmshift.backendFarmShift;

import com.farmshift.backendFarmShift.dto.AiAssistantResponse;
import com.farmshift.backendFarmShift.dto.request.BarnWorkersRequest;
import com.farmshift.backendFarmShift.entity.*;
import com.farmshift.backendFarmShift.repository.*;
import com.farmshift.backendFarmShift.security.RoleNames;
import com.farmshift.backendFarmShift.service.AiAssistantService;
import com.farmshift.backendFarmShift.service.VietnameseSpeechNormalizer;
import com.farmshift.backendFarmShift.service.WorkAssignmentService;
import com.farmshift.backendFarmShift.service.ai.AiRateLimiter;
import com.farmshift.backendFarmShift.service.ai.AssistantCommandDispatcher;
import com.farmshift.backendFarmShift.service.ai.AssistantExecutionContext;
import com.farmshift.backendFarmShift.service.ai.handler.StructuredLlmToolFallbackHandler;
import com.farmshift.backendFarmShift.service.iot.IotTelemetryRegistry;
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

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@WithMockUser(username = "owner@farm.test", authorities = "ROLE_FARM_OWNER")
class Stage1AiUpgradeTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired BarnRepository barnRepository;
    @Autowired AccountRepository accountRepository;
    @Autowired RoleRepository roleRepository;
    @Autowired WorkAssignmentService workAssignmentService;
    @Autowired StructuredLlmToolFallbackHandler toolFallbackHandler;
    @Autowired AssistantCommandDispatcher commandDispatcher;
    @Autowired IotTelemetryRegistry iotTelemetryRegistry;
    @Autowired AiRateLimiter rateLimiter;
    @Autowired AiAssistantService aiAssistantService;
    @Autowired InventoryItemRepository inventoryRepository;
    @Autowired ProductCategoryRepository productRepository;
    @Autowired WarehouseCategoryRepository warehouseRepository;
    @Autowired MeasurementUnitRepository unitRepository;
    @Autowired BrandRepository brandRepository;
    @Autowired SupplierRepository supplierRepository;
    @Autowired ProductTypeRepository productTypeRepository;
    @Autowired PurchaseInvoiceRepository invoiceRepository;

    private Barn barnA1;
    private Barn barnB2;

    @BeforeEach
    void setUp() throws Exception {
        rateLimiter.resetAll();
        iotTelemetryRegistry.clear();

        long areaA = id(postJson("/api/farm-areas", Map.of("name", "Khu A IoT")));
        long barnA1Id = id(postJson("/api/barns", Map.of("areaId", areaA, "name", "Nhà A1", "capacity", 5000, "areaM2", 450)));
        long barnB2Id = id(postJson("/api/barns", Map.of("areaId", areaA, "name", "Nhà B2", "capacity", 4000, "areaM2", 380)));

        long progId = id(postJson("/api/farming-programs", Map.of(
                "name", "Gà Mía IoT Test",
                "breed", "Gà Mía",
                "durationDays", 90,
                "steps", List.of(
                        Map.of(
                                "category", "FEED",
                                "name", "Higro 01",
                                "dayFrom", 1,
                                "dayTo", 30,
                                "quantity", 20,
                                "mealsPerDay", 4
                        ),
                        Map.of(
                                "category", "TEMPERATURE",
                                "name", "Nhiệt độ chuẩn giai đoạn 2",
                                "dayFrom", 1,
                                "dayTo", 30,
                                "tempMin", 28.0,
                                "tempMax", 31.5
                        )
                )
        )));

        long cycleId = id(postJson("/api/barns/" + barnA1Id + "/cycles", Map.of("startDate", LocalDate.now().minusDays(5).toString())));
        id(postJson("/api/cycles/" + cycleId + "/flocks", Map.of(
                "name", "Đàn A1 IoT",
                "programId", progId,
                "gender", "MALE",
                "importDate", LocalDate.now().minusDays(5).toString(),
                "ageAtImport", 1,
                "quantity", 1500,
                "avgWeight", 0.04,
                "unitPrice", 11000,
                "sourceNote", "Dabaco"
        )));

        barnA1 = barnRepository.findById(barnA1Id).orElseThrow();
        barnB2 = barnRepository.findById(barnB2Id).orElseThrow();
    }

    @Test
    void testNativeToolCallingSchemasRespectRbacAndNormalizeAliases() throws Exception {
        Set<String> workerTools = toolFallbackHandler.buildToolSchemas(true, false).stream()
                .map(t -> String.valueOf(((Map<?, ?>) t.get("function")).get("name")))
                .collect(Collectors.toSet());
        assertTrue(workerTools.contains("log_feed"));
        assertTrue(workerTools.contains("vet_diagnosis"));
        assertFalse(workerTools.contains("log_expense"), "Worker must NOT see financial tool schemas");
        assertFalse(workerTools.contains("pay_purchase_invoice"));
        assertFalse(workerTools.contains("update_barn_info"));

        Set<String> accountantTools = toolFallbackHandler.buildToolSchemas(false, true).stream()
                .map(t -> String.valueOf(((Map<?, ?>) t.get("function")).get("name")))
                .collect(Collectors.toSet());
        assertTrue(accountantTools.contains("pay_purchase_invoice"));
        assertTrue(accountantTools.contains("update_inventory_item"));
        assertFalse(accountantTools.contains("log_feed"), "Accountant must NOT see barn feed logging tool");

        Set<String> ownerTools = toolFallbackHandler.buildToolSchemas(false, false).stream()
                .map(t -> String.valueOf(((Map<?, ?>) t.get("function")).get("name")))
                .collect(Collectors.toSet());
        assertTrue(ownerTools.contains("update_barn_info"));
        assertTrue(ownerTools.contains("log_feed"));
        assertTrue(ownerTools.contains("log_expense"));

        // Verify native toolCalls normalization (including 2 bao -> 50.0 kg)
        JsonNode nativeToolResp = mapper.readTree("""
                {
                  "content": "",
                  "toolCalls": [
                    {
                      "id": "call_1",
                      "type": "function",
                      "function": {
                        "name": "log_feed",
                        "arguments": "{\\"targetBarnName\\":\\"Nhà A1\\",\\"itemName\\":\\"Higro 01\\",\\"quantity\\":2,\\"unit\\":\\"bao\\"}"
                      }
                    }
                  ]
                }
                """);
        JsonNode canonical = toolFallbackHandler.extractCanonicalCommandJson(nativeToolResp, mapper);
        assertNotNull(canonical);
        assertEquals("LOG_FEED", canonical.path("intent").asText());
        assertEquals("Nhà A1", canonical.path("targetBarnName").asText());
        assertEquals("Higro 01", canonical.path("feedName").asText());
        assertEquals(50.0, canonical.path("feedKg").asDouble(), 0.001);
    }

    @Test
    void testIotTelemetryHandlerNeverFabricatesNumbersAndUsesLiveMqttSync() throws Exception {
        // 1. Before any ESP32 telemetry arrives: NO fake 29.4°C or 68%
        String noTelemetryResp = mvc.perform(post("/api/ai/assistant")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of(
                                "message", "Nhiệt độ và độ ẩm Nhà A1 hiện tại thế nào?",
                                "currentRoute", "/dashboard"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.actionType").value("QUERY_IOT_TELEMETRY"))
                .andExpect(jsonPath("$.dataCard.status").value("NO_LIVE_TELEMETRY"))
                .andExpect(jsonPath("$.dataCard.recommendedTempRange").value("28.0 – 31.5°C"))
                .andReturn().getResponse().getContentAsString();
        assertFalse(noTelemetryResp.contains("29.4"), "Must not return hardcoded fake temperature");
        assertFalse(noTelemetryResp.contains("NH3: 8ppm"), "Must not return fabricated air quality");

        // 2. Push real ESP32 telemetry via /api/iot/telemetry
        mvc.perform(post("/api/iot/telemetry")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of(
                                "barnId", barnA1.getId(),
                                "connected", true,
                                "temp1", 33.2,
                                "humi1", 72,
                                "temp3", 33.8,
                                "humi3", 74,
                                "relayStates", Map.of("4", true, "2", false),
                                "activeDeviceLabels", List.of("Quạt gió (Đang bật)")
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("LIVE"))
                .andExpect(jsonPath("$.data.avgTemperature").value(33.5))
                .andExpect(jsonPath("$.data.avgHumidity").value(73));

        // 3. Query AI assistant again -> reflects exact real sensor data + high-temp warning (>31.5°C)
        mvc.perform(post("/api/ai/assistant")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of(
                                "message", "Nhiệt độ Nhà A1 bây giờ bao nhiêu?",
                                "currentRoute", "/dashboard"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.actionType").value("QUERY_IOT_TELEMETRY"))
                .andExpect(jsonPath("$.dataCard.status").value("LIVE"))
                .andExpect(jsonPath("$.dataCard.temperature").value("33.5°C"))
                .andExpect(jsonPath("$.dataCard.humidity").value("73%"))
                .andExpect(jsonPath("$.dataCard.ventilationStatus").value("Quạt gió (Đang bật)"));

        // 4. Worker RBAC check for unassigned barn B2
        Role workerRole = roleRepository.findByName(RoleNames.FARM_WORKER).orElseGet(() -> {
            Role role = new Role();
            role.setName(RoleNames.FARM_WORKER);
            return roleRepository.saveAndFlush(role);
        });
        Account worker = new Account();
        worker.setEmail("worker-iot@farm.test");
        worker.setPassword("bcrypt-stub");
        worker.setFullName("Công nhân IoT");
        worker.setRole(workerRole);
        worker.setIsActive(true);
        worker = accountRepository.saveAndFlush(worker);
        workAssignmentService.setBarnWorkers(barnA1.getId(), new BarnWorkersRequest(List.of(worker.getId())), "owner@farm.test");

        mvc.perform(get("/api/iot/telemetry/" + barnB2.getId())
                        .with(user("worker-iot@farm.test").authorities(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_FARM_WORKER"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errorCode").value("BARN_NOT_ASSIGNED"));

        // 5. Multi-barn telemetry query ("các chuồng") summarizes both barns instead of picking one arbitrary barn
        mvc.perform(post("/api/ai/assistant")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of(
                                "message", "Nhiệt độ và độ ẩm các chuồng hiện tại thế nào?",
                                "currentRoute", "/dashboard"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.actionType").value("QUERY_IOT_TELEMETRY"))
                .andExpect(jsonPath("$.dataCard.type").value("IOT_TELEMETRY_MULTI"))
                .andExpect(jsonPath("$.dataCard.totalBarns").value(org.hamcrest.Matchers.greaterThanOrEqualTo(2)))
                .andExpect(jsonPath("$.reply").value(org.hamcrest.Matchers.containsString("Nhà A1")))
                .andExpect(jsonPath("$.reply").value(org.hamcrest.Matchers.containsString("Nhà B2")));

        // 6. Disconnecting ESP32 with null sensor fields preserves last known readings (DISCONNECTED instead of wiping to NO_LIVE_TELEMETRY)
        mvc.perform(post("/api/iot/telemetry")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of(
                                "barnId", barnA1.getId(),
                                "connected", false,
                                "source", "ESP32_MQTT"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("DISCONNECTED"))
                .andExpect(jsonPath("$.data.avgTemperature").value(33.5))
                .andExpect(jsonPath("$.data.avgHumidity").value(73));

        // 7. Word boundary guard: asking about nonexistent "Nhà A10" must NOT falsely match "Nhà A1"
        String a10Resp = mvc.perform(post("/api/ai/assistant")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of(
                                "message", "Nhiệt độ Nhà A10 hiện tại thế nào?",
                                "currentRoute", "/dashboard"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.actionType").value("QUERY_IOT_TELEMETRY"))
                .andReturn().getResponse().getContentAsString();
        assertFalse(a10Resp.contains("33.5°C"), "Nhà A10 query must not fall back to Nhà A1 substring match: " + a10Resp);
    }

    @Test
    void testStructuredLlmToolFallbackHandlerDispatchesWhenLlmFallbackPhaseTrue() {
        AssistantExecutionContext detCtx = AssistantExecutionContext.builder()
                .message("Câu hỏi phức tạp")
                .username("owner@farm.test")
                .llmFallbackPhase(false)
                .build();
        assertFalse(toolFallbackHandler.canHandle(detCtx));

        AssistantExecutionContext llmCtx = AssistantExecutionContext.builder()
                .message("Câu hỏi phức tạp không khớp rule")
                .username("owner@farm.test")
                .llmFallbackPhase(true)
                .build();
        assertTrue(toolFallbackHandler.canHandle(llmCtx));
        // When ai-service.url is unreachable/offline in test profile, dispatcher cleanly returns null for RAG fallback
        assertNull(commandDispatcher.dispatch(llmCtx));
    }

    @Test
    void testSharedPhoneticLexiconLoadedInJavaNormalizer() {
        String norm = VietnameseSpeechNormalizer.normalizeSpokenTranscript(
                "tiêm ma réc, pha gờ lu cô ka xê, dùng hàn cốc và bkc 80% cho gà lạc thủy"
        );
        assertTrue(norm.contains("Marek"), norm);
        assertTrue(norm.contains("Gluco-K-C"), norm);
        assertTrue(norm.contains("Toltrazuril"), norm);
        assertTrue(norm.contains("BKC 80%"), norm);
        assertTrue(norm.contains("Gà Lạc Thủy"), norm);
    }

    @Test
    void testExecuteActionFromLlmResolvesInventoryAndInvoiceWithoutIdAndParsesVnNumbers() throws Exception {
        WarehouseCategory wh = new WarehouseCategory();
        wh.setName("Kho Test LLM");
        wh.setNameKey("kho test llm");
        wh = warehouseRepository.saveAndFlush(wh);

        MeasurementUnit unit = new MeasurementUnit();
        unit.setCode("BAO_LLM");
        unit.setCodeKey("bao_llm");
        unit.setName("Bao");
        unit.setNameKey("bao");
        unit = unitRepository.saveAndFlush(unit);

        Brand brand = new Brand();
        brand.setName("Higro LLM");
        brand.setNameKey("higro_llm");
        brand.setProductType("Thức ăn");
        brand = brandRepository.saveAndFlush(brand);

        ProductCategory prod = new ProductCategory();
        prod.setName("Cám Higro 01 LLM");
        prod.setNameKey("cam higro 01 llm");
        prod.setWarehouse(wh);
        prod = productRepository.saveAndFlush(prod);

        InventoryItem item = new InventoryItem();
        item.setProduct(prod);
        item.setWarehouse(wh);
        item.setBrand(brand);
        item.setUnit(unit);
        item.setStock(new java.math.BigDecimal("20.000000"));
        item.setPrice(new java.math.BigDecimal("320000.00"));
        item = inventoryRepository.saveAndFlush(item);

        // 1. UPDATE_INVENTORY_ITEM from native tool call without targetEntityId and VN currency string "350.000 đ"
        JsonNode updateToolResp = mapper.readTree("""
                {
                  "toolCalls": [
                    {
                      "id": "call_inv_1",
                      "type": "function",
                      "function": {
                        "name": "update_inventory_item",
                        "arguments": "{\\"itemName\\":\\"Cám Higro 01 LLM\\",\\"fieldToUpdate\\":\\"price\\",\\"newValue\\":\\"350.000 đ\\"}"
                      }
                    }
                  ]
                }
                """);
        JsonNode canonicalInv = toolFallbackHandler.extractCanonicalCommandJson(updateToolResp, mapper);
        AiAssistantResponse invRes = org.springframework.test.util.ReflectionTestUtils.invokeMethod(
                aiAssistantService,
                "executeActionFromLlm",
                "UPDATE_INVENTORY_ITEM",
                canonicalInv,
                "Cập nhật giá Cám Higro 01 LLM thành 350.000 đ",
                "/inventory",
                "owner@farm.test",
                false,
                false,
                false
        );
        assertNotNull(invRes);
        assertTrue(invRes.isRequiresConfirmation());
        @SuppressWarnings("unchecked")
        Map<String, Object> invPayload = (Map<String, Object>) invRes.getPendingAction().get("payload");
        assertEquals(item.getId(), invPayload.get("itemId"));
        assertEquals(350000.0, ((Number) invPayload.get("price")).doubleValue(), 0.01);

        // 2. Unknown inventory item returns CLARIFICATION_REQUIRED instead of a broken confirmation card
        JsonNode missingInv = mapper.readTree("""
                {"intent":"UPDATE_INVENTORY_ITEM","itemName":"Sản phẩm không tồn tại XYZ","fieldToUpdate":"price","newValue":"100000"}
                """);
        AiAssistantResponse missingInvRes = org.springframework.test.util.ReflectionTestUtils.invokeMethod(
                aiAssistantService,
                "executeActionFromLlm",
                "UPDATE_INVENTORY_ITEM",
                missingInv,
                "Sửa giá Sản phẩm không tồn tại XYZ",
                "/inventory",
                "owner@farm.test",
                false,
                false,
                false
        );
        assertNotNull(missingInvRes);
        assertEquals("CLARIFICATION_REQUIRED", missingInvRes.getActionType());
        assertFalse(missingInvRes.isRequiresConfirmation());

        // 3. PAY_PURCHASE_INVOICE without amount prompts for clarification with invoice remaining debt
        ProductType pt = new ProductType();
        pt.setCode("PT_LLM");
        pt.setName("Thức ăn LLM");
        pt.setNameKey("thuc an llm");
        pt = productTypeRepository.saveAndFlush(pt);

        Supplier sup = new Supplier();
        sup.setName("NCC LLM");
        sup.setNameKey("ncc llm");
        sup.setRepresentative("Đại diện");
        sup.setPhone("0909998887");
        sup.setProductType(pt);
        sup.setOpeningDebt(0L);
        sup = supplierRepository.saveAndFlush(sup);

        PurchaseInvoice inv = new PurchaseInvoice();
        inv.setCode("NH000777");
        inv.setSupplier(sup);
        inv.setInvoiceDate(LocalDate.now());
        inv.setTotalAmount(5_000_000L);
        inv.setPaidAmount(1_000_000L);
        inv.setPaymentStatus("Thanh toán một phần");
        inv.setStockStatus("Đã nhập kho");
        invoiceRepository.saveAndFlush(inv);

        JsonNode payNoAmount = mapper.readTree("""
                {"intent":"PAY_PURCHASE_INVOICE","targetCode":"NH000777"}
                """);
        AiAssistantResponse payRes = org.springframework.test.util.ReflectionTestUtils.invokeMethod(
                aiAssistantService,
                "executeActionFromLlm",
                "PAY_PURCHASE_INVOICE",
                payNoAmount,
                "Thanh toán hóa đơn NH000777",
                "/purchases",
                "owner@farm.test",
                false,
                false,
                false
        );
        assertNotNull(payRes);
        assertEquals("CLARIFICATION_REQUIRED", payRes.getActionType());
        assertFalse(payRes.isRequiresConfirmation());
        assertTrue(payRes.getReply().contains("4.000.000"));

        // 4. Explicit nonexistent targetBarnName ("Nhà A99") on /barns/{barnA1} must NOT fall back to barnA1
        JsonNode missingBarnFeed = mapper.readTree("""
                {"intent":"LOG_FEED","targetBarnName":"Nhà A99","itemName":"Cám Higro 01 LLM","quantity":50,"unit":"kg"}
                """);
        AiAssistantResponse missingBarnRes = org.springframework.test.util.ReflectionTestUtils.invokeMethod(
                aiAssistantService,
                "executeActionFromLlm",
                "LOG_FEED",
                missingBarnFeed,
                "Cho Nhà A99 ăn 50kg cám",
                "/barns/" + barnA1.getId(),
                "owner@farm.test",
                false,
                false,
                false
        );
        assertNotNull(missingBarnRes);
        assertFalse(missingBarnRes.isRequiresConfirmation());
        assertFalse(missingBarnRes.isExecuted());
        assertEquals("NONE", missingBarnRes.getActionType());

        // 5. CANCEL_PURCHASE_INVOICE for nonexistent code returns CLARIFICATION_REQUIRED
        JsonNode cancelMissingInv = mapper.readTree("""
                {"intent":"CANCEL_PURCHASE_INVOICE","targetCode":"NH999999"}
                """);
        AiAssistantResponse cancelMissingRes = org.springframework.test.util.ReflectionTestUtils.invokeMethod(
                aiAssistantService,
                "executeActionFromLlm",
                "CANCEL_PURCHASE_INVOICE",
                cancelMissingInv,
                "Hủy hóa đơn NH999999",
                "/purchases",
                "owner@farm.test",
                false,
                false,
                false
        );
        assertNotNull(cancelMissingRes);
        assertEquals("CLARIFICATION_REQUIRED", cancelMissingRes.getActionType());
        assertFalse(cancelMissingRes.isRequiresConfirmation());
    }

    @Test
    void testFarmStatusQueryNeverFabricatesTemperaturesAndWorkerWithoutBarnsGetsMsg51() throws Exception {
        // 1. General farm status query must NOT return hardcoded "27°C - 29.5°C, độ ẩm 68% - 74%"
        String farmStatusBody = mvc.perform(post("/api/ai/assistant")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of(
                                "message", "Tình trạng trang trại hiện tại thế nào?",
                                "currentRoute", "/dashboard"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.actionType").value("QUERY_FARM_STATUS"))
                .andReturn().getResponse().getContentAsString();
        assertFalse(farmStatusBody.contains("27°C - 29.5°C"), "Must not fabricate mock temperatures: " + farmStatusBody);
        assertFalse(farmStatusBody.contains("68% - 74%"), "Must not fabricate mock humidity: " + farmStatusBody);

        // 2. Worker with 0 assigned barns querying IoT telemetry must receive BARN_NOT_ASSIGNED (MSG51)
        Role workerRole = roleRepository.findByName(RoleNames.FARM_WORKER).orElseGet(() -> {
            Role role = new Role();
            role.setName(RoleNames.FARM_WORKER);
            return roleRepository.saveAndFlush(role);
        });
        Account unassignedWorker = new Account();
        unassignedWorker.setEmail("unassigned-iot@farm.test");
        unassignedWorker.setPassword("bcrypt-stub");
        unassignedWorker.setFullName("Công nhân Chưa Gán");
        unassignedWorker.setRole(workerRole);
        unassignedWorker.setIsActive(true);
        accountRepository.saveAndFlush(unassignedWorker);

        mvc.perform(post("/api/ai/assistant")
                        .with(user("unassigned-iot@farm.test").authorities(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_FARM_WORKER")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of(
                                "message", "Nhiệt độ các chuồng hiện tại bao nhiêu?",
                                "currentRoute", "/today-tasks"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.actionType").value("BARN_NOT_ASSIGNED"))
                .andExpect(jsonPath("$.executed").value(false));
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
