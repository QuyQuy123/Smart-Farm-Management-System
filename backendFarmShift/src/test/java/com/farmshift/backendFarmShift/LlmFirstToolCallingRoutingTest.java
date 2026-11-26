package com.farmshift.backendFarmShift;

import com.farmshift.backendFarmShift.config.RealtimeSyncInterceptor;
import com.farmshift.backendFarmShift.dto.request.BarnWorkersRequest;
import com.farmshift.backendFarmShift.entity.*;
import com.farmshift.backendFarmShift.repository.*;
import com.farmshift.backendFarmShift.security.RoleNames;
import com.farmshift.backendFarmShift.service.AiAssistantService;
import com.farmshift.backendFarmShift.service.CycleService;
import com.farmshift.backendFarmShift.service.RealtimeSyncService;
import com.farmshift.backendFarmShift.service.WorkAssignmentService;
import com.farmshift.backendFarmShift.service.ai.AiRateLimiter;
import com.farmshift.backendFarmShift.service.ai.AiSecurityGuard;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * End-to-end verification of the LLM-First Tool Calling architecture (all 8 acceptance scenarios
 * in .md/ai_agent_routing_spec.md), Daily Briefing, post-LLM guardrails, offline Tier 2 fallback,
 * and RealtimeSyncInterceptor /api/iot/ exclusion.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = {
        "ai-service.llm-first-enabled=true",
        "ai-service.allow-client-auto-execute=false"
})
@Transactional
@WithMockUser(username = "owner@farm.test", authorities = "ROLE_FARM_OWNER")
class LlmFirstToolCallingRoutingTest {

    private static final String CHAT_URL = "http://localhost:8000/api/voice/chat";

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired AiAssistantService aiAssistantService;
    @Autowired AiRateLimiter rateLimiter;
    @Autowired AiInteractionLogRepository logRepository;
    @Autowired BarnRepository barnRepository;
    @Autowired FarmingCycleRepository cycleRepository;
    @Autowired FeedRecordRepository feedRepository;
    @Autowired WeightSampleRepository weightRepository;
    @Autowired SupplierRepository supplierRepository;
    @Autowired ProductTypeRepository productTypeRepository;
    @Autowired PurchaseInvoiceRepository invoiceRepository;
    @Autowired AccountRepository accountRepository;
    @Autowired RoleRepository roleRepository;
    @Autowired WorkAssignmentService workAssignmentService;

    private MockRestServiceServer mockAiServer;
    private Barn barnA1;
    private Barn barnB2;
    private FarmingCycle cycleA1;
    private FarmingCycle cycleB2;
    private Account workerAccount;

    @BeforeEach
    void setUp() throws Exception {
        rateLimiter.resetAll();
        aiAssistantService.resetCircuitBreaker();
        mockAiServer = MockRestServiceServer.bindTo(aiAssistantService.getRestTemplateForTest()).build();

        long areaA = id(postJson("/api/farm-areas", Map.of("name", "Khu A LLM-First")));
        long barnA1Id = id(postJson("/api/barns", Map.of("areaId", areaA, "name", "Nhà A1", "capacity", 5000, "areaM2", 450)));
        long barnB2Id = id(postJson("/api/barns", Map.of("areaId", areaA, "name", "Nhà B2", "capacity", 4000, "areaM2", 380)));

        long progId = id(postJson("/api/farming-programs", Map.of(
                "name", "Chương trình LLM-First",
                "breed", "Gà Mía",
                "durationDays", 90,
                "steps", List.of(
                        Map.of(
                                "category", "FEED",
                                "name", "Cám Higro 01",
                                "dayFrom", 1,
                                "dayTo", 60,
                                "quantity", 25,
                                "mealsPerDay", 2,
                                "time", "00:05"
                        ),
                        Map.of(
                                "category", "TEMPERATURE",
                                "name", "Nhiệt độ giai đoạn 2",
                                "dayFrom", 21,
                                "dayTo", 60,
                                "tempMin", 24.0,
                                "tempMax", 26.0
                        )
                )
        )));

        LocalDate start = LocalDate.now(CycleService.VN_ZONE).minusDays(30);
        long cycleA1Id = id(postJson("/api/barns/" + barnA1Id + "/cycles", Map.of("startDate", start.toString())));
        id(postJson("/api/cycles/" + cycleA1Id + "/flocks", Map.of(
                "name", "Đàn A1",
                "programId", progId,
                "gender", "MALE",
                "importDate", start.toString(),
                "ageAtImport", 1,
                "quantity", 1500,
                "avgWeight", 0.04,
                "unitPrice", 11000,
                "sourceNote", "Dabaco"
        )));

        long cycleB2Id = id(postJson("/api/barns/" + barnB2Id + "/cycles", Map.of("startDate", start.toString())));
        id(postJson("/api/cycles/" + cycleB2Id + "/flocks", Map.of(
                "name", "Đàn B2",
                "programId", progId,
                "gender", "MALE",
                "importDate", start.toString(),
                "ageAtImport", 1,
                "quantity", 1000,
                "avgWeight", 0.04,
                "unitPrice", 11000,
                "sourceNote", "CP"
        )));

        barnA1 = barnRepository.findById(barnA1Id).orElseThrow();
        barnB2 = barnRepository.findById(barnB2Id).orElseThrow();
        cycleA1 = cycleRepository.findById(cycleA1Id).orElseThrow();
        cycleB2 = cycleRepository.findById(cycleB2Id).orElseThrow();

        // Seed feed + weights so Nhà A1 has healthy FCR (~1.5) and Nhà B2 has high FCR (~2.5)
        FeedRecord feedA1 = new FeedRecord();
        feedA1.setCycle(cycleA1);
        feedA1.setRecordDate(LocalDate.now(CycleService.VN_ZONE));
        feedA1.setFeedName("Cám Higro 01");
        feedA1.setQuantityKg(new BigDecimal("2250"));
        feedA1.setUnitPrice(new BigDecimal("14500"));
        feedRepository.saveAndFlush(feedA1);

        WeightSample wsA1 = new WeightSample();
        wsA1.setCycle(cycleA1);
        wsA1.setSampleDate(LocalDate.now(CycleService.VN_ZONE));
        wsA1.setAvgWeightKg(new BigDecimal("1.04"));
        wsA1.setSampleSize(50);
        weightRepository.saveAndFlush(wsA1);

        FeedRecord feedB2 = new FeedRecord();
        feedB2.setCycle(cycleB2);
        feedB2.setRecordDate(LocalDate.now(CycleService.VN_ZONE));
        feedB2.setFeedName("Cám Higro 01");
        feedB2.setQuantityKg(new BigDecimal("2500"));
        feedB2.setUnitPrice(new BigDecimal("14500"));
        feedRepository.saveAndFlush(feedB2);

        WeightSample wsB2 = new WeightSample();
        wsB2.setCycle(cycleB2);
        wsB2.setSampleDate(LocalDate.now(CycleService.VN_ZONE));
        wsB2.setAvgWeightKg(new BigDecimal("1.04"));
        wsB2.setSampleSize(50);
        weightRepository.saveAndFlush(wsB2);

        // Seed 2 suppliers with real unpaid invoices (NCC CP Việt Nam owes most: 45M vs 12M)
        ProductType pt = new ProductType();
        pt.setCode("PT_LLMF");
        pt.setName("Thức ăn LLMF");
        pt.setNameKey("thuc an llmf");
        pt = productTypeRepository.saveAndFlush(pt);

        Supplier supDeHeus = new Supplier();
        supDeHeus.setName("NCC De Heus");
        supDeHeus.setNameKey("ncc de heus");
        supDeHeus.setRepresentative("A");
        supDeHeus.setPhone("0901111222");
        supDeHeus.setProductType(pt);
        supDeHeus.setOpeningDebt(0L);
        supDeHeus = supplierRepository.saveAndFlush(supDeHeus);

        Supplier supCp = new Supplier();
        supCp.setName("NCC CP Việt Nam");
        supCp.setNameKey("ncc cp viet nam");
        supCp.setRepresentative("B");
        supCp.setPhone("0903333444");
        supCp.setProductType(pt);
        supCp.setOpeningDebt(0L);
        supCp = supplierRepository.saveAndFlush(supCp);

        PurchaseInvoice inv1 = new PurchaseInvoice();
        inv1.setCode("NH009001");
        inv1.setSupplier(supDeHeus);
        inv1.setInvoiceDate(LocalDate.now(CycleService.VN_ZONE).minusDays(10));
        inv1.setTotalAmount(20_000_000L);
        inv1.setPaidAmount(8_000_000L);
        inv1.setPaymentStatus("Thanh toán một phần");
        inv1.setStockStatus("Đã nhập kho");
        invoiceRepository.saveAndFlush(inv1);

        PurchaseInvoice inv2 = new PurchaseInvoice();
        inv2.setCode("NH009002");
        inv2.setSupplier(supCp);
        inv2.setInvoiceDate(LocalDate.now(CycleService.VN_ZONE).minusDays(5));
        inv2.setTotalAmount(50_000_000L);
        inv2.setPaidAmount(5_000_000L);
        inv2.setPaymentStatus("Thanh toán một phần");
        inv2.setStockStatus("Đã nhập kho");
        invoiceRepository.saveAndFlush(inv2);

        // Seed worker assigned ONLY to Nhà A1
        Role workerRole = roleRepository.findByName(RoleNames.FARM_WORKER).orElseGet(() -> {
            Role role = new Role();
            role.setName(RoleNames.FARM_WORKER);
            return roleRepository.saveAndFlush(role);
        });
        workerAccount = new Account();
        workerAccount.setEmail("worker-llmf@farm.test");
        workerAccount.setPassword("bcrypt-stub");
        workerAccount.setFullName("Công nhân A1");
        workerAccount.setRole(workerRole);
        workerAccount.setIsActive(true);
        workerAccount = accountRepository.saveAndFlush(workerAccount);
        workAssignmentService.setBarnWorkers(barnA1.getId(), new BarnWorkersRequest(List.of(workerAccount.getId())), "owner@farm.test");
    }

    @AfterEach
    void tearDown() {
        mockAiServer.reset();
    }

    @Test
    void scenario1_casualTypoGreeting_handledByLlmChatWithoutClarificationBox() throws Exception {
        mockAiServer.expect(requestTo(CHAT_URL))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess(
                        "{\"content\":\"Chào bạn! Bạn đang ở trang Tổng quan, cần tôi tóm tắt nhanh tình hình trại hay kiểm tra chuồng nào không?\",\"provider\":\"llama-3.3-70b-versatile\",\"fallback\":false}",
                        MediaType.APPLICATION_JSON
                ));

        String body = mvc.perform(post("/api/ai/assistant")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of(
                                "message", "holo",
                                "currentRoute", "/dashboard"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.actionType").value("GENERAL_QNA"))
                .andExpect(jsonPath("$.reply", containsString("Chào bạn")))
                .andExpect(jsonPath("$.reply", not(containsString("Tôi chưa rõ bạn muốn thực hiện nghiệp vụ gì"))))
                .andReturn().getResponse().getContentAsString();

        mockAiServer.verify();
        long logId = mapper.readTree(body).path("interactionId").asLong();
        AiInteractionLog stored = logRepository.findById(logId).orElseThrow();
        assertEquals("LLM_CHAT", stored.getHandlerTier());
        assertEquals("llama-3.3-70b-versatile", stored.getProvider());
    }

    @Test
    void scenario2_dailyBriefing_executesGetDashboardSummaryAndSynthesizesRealDbData() throws Exception {
        AtomicReference<String> turn2ToolPayload = new AtomicReference<>();

        mockAiServer.expect(requestTo(CHAT_URL))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess(
                        "{\"content\":\"\",\"toolCalls\":[{\"id\":\"call_dash_1\",\"type\":\"function\",\"function\":{\"name\":\"get_dashboard_summary\",\"arguments\":\"{}\"}}],\"provider\":\"llama-3.3-70b-versatile\",\"fallback\":false}",
                        MediaType.APPLICATION_JSON
                ));

        mockAiServer.expect(requestTo(CHAT_URL))
                .andExpect(method(HttpMethod.POST))
                .andExpect(req -> {
                    JsonNode sent = mapper.readTree(req.getBody().toString());
                    JsonNode toolMsgs = sent.path("toolMessages");
                    assertTrue(toolMsgs.isArray() && toolMsgs.size() == 2);
                    turn2ToolPayload.set(toolMsgs.get(1).path("content").asText());
                })
                .andRespond(withSuccess(
                        "{\"content\":\"Hôm nay trại có việc quá giờ cần xử lý, Nhà B2 đang có FCR cao (2.50), và tổng công nợ NCC 57.000.000 đ.\",\"provider\":\"llama-3.3-70b-versatile\",\"fallback\":false}",
                        MediaType.APPLICATION_JSON
                ));

        String body = mvc.perform(post("/api/ai/assistant")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of(
                                "message", "hôm nay có gì mới",
                                "currentRoute", "/dashboard"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.actionType").value("DAILY_BRIEFING"))
                .andExpect(jsonPath("$.reply", containsString("Nhà B2")))
                .andReturn().getResponse().getContentAsString();

        mockAiServer.verify();
        JsonNode toolData = mapper.readTree(turn2ToolPayload.get());
        assertEquals(2500, toolData.path("kpis").path("liveQuantity").asInt());
        assertEquals(57_000_000L, toolData.path("kpis").path("supplierDebtVnd").asLong());

        long logId = mapper.readTree(body).path("interactionId").asLong();
        AiInteractionLog stored = logRepository.findById(logId).orElseThrow();
        assertEquals("LLM_TOOL_CALL", stored.getHandlerTier());
        assertEquals("llama-3.3-70b-versatile", stored.getProvider());
    }

    @Test
    void scenario3_worstFcrBarn_executesGetBarnStatusSortedByFcr() throws Exception {
        AtomicReference<String> turn2ToolPayload = new AtomicReference<>();

        mockAiServer.expect(requestTo(CHAT_URL))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess(
                        "{\"content\":\"\",\"toolCalls\":[{\"id\":\"call_barn_1\",\"type\":\"function\",\"function\":{\"name\":\"get_barn_status\",\"arguments\":\"{\\\"sort_by\\\":\\\"fcr\\\"}\"}}],\"provider\":\"llama-3.3-70b-versatile\",\"fallback\":false}",
                        MediaType.APPLICATION_JSON
                ));

        mockAiServer.expect(requestTo(CHAT_URL))
                .andExpect(method(HttpMethod.POST))
                .andExpect(req -> {
                    JsonNode sent = mapper.readTree(req.getBody().toString());
                    turn2ToolPayload.set(sent.path("toolMessages").get(1).path("content").asText());
                })
                .andRespond(withSuccess(
                        "{\"content\":\"Nhà B2 đang có FCR cao nhất (2.50), cao hơn Nhà A1 (1.50).\",\"provider\":\"llama-3.3-70b-versatile\",\"fallback\":false}",
                        MediaType.APPLICATION_JSON
                ));

        mvc.perform(post("/api/ai/assistant")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of(
                                "message", "chuồng nào đang toang FCR nhất?",
                                "currentRoute", "/dashboard"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.actionType").value("QUERY_FARM_STATUS"))
                .andExpect(jsonPath("$.reply", containsString("Nhà B2")));

        mockAiServer.verify();
        JsonNode toolData = mapper.readTree(turn2ToolPayload.get());
        assertEquals("Nhà B2", toolData.path("barns").get(0).path("barnName").asText());
        assertTrue(toolData.path("barns").get(0).path("fcr").asDouble() > toolData.path("barns").get(1).path("fcr").asDouble());
    }

    @Test
    void scenario4_poultryVetQuestion_executesSearchVetKnowledgeAndAppendsMsg38() throws Exception {
        AtomicReference<String> turn2ToolPayload = new AtomicReference<>();

        mockAiServer.expect(requestTo(CHAT_URL))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess(
                        "{\"content\":\"\",\"toolCalls\":[{\"id\":\"call_vet_1\",\"type\":\"function\",\"function\":{\"name\":\"search_vet_knowledge\",\"arguments\":\"{\\\"query\\\":\\\"gà 30 ngày khò khè vẩy mỏ\\\"}\"}}],\"provider\":\"llama-3.3-70b-versatile\",\"fallback\":false}",
                        MediaType.APPLICATION_JSON
                ));

        mockAiServer.expect(requestTo(CHAT_URL))
                .andExpect(method(HttpMethod.POST))
                .andExpect(req -> {
                    JsonNode sent = mapper.readTree(req.getBody().toString());
                    turn2ToolPayload.set(sent.path("toolMessages").get(1).path("content").asText());
                })
                .andRespond(withSuccess(
                        "{\"content\":\"Triệu chứng khò khè, vẩy mỏ ở gà 30 ngày thường liên quan bệnh hô hấp CRD/ORT. Hướng xử lý: tăng thông thoáng, bổ sung điện giải + men, dùng kháng sinh hô hấp theo phác đồ.\",\"provider\":\"llama-3.3-70b-versatile\",\"fallback\":false}",
                        MediaType.APPLICATION_JSON
                ));

        mvc.perform(post("/api/ai/assistant")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of(
                                "message", "gà 30 ngày bị khò khè, vẩy mỏ xử lý thế nào?",
                                "currentRoute", "/dashboard"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.actionType").value("VET_DIAGNOSIS"))
                .andExpect(jsonPath("$.reply", containsString("CRD")))
                .andExpect(jsonPath("$.reply", containsString("MSG38")));

        mockAiServer.verify();
        JsonNode ragData = mapper.readTree(turn2ToolPayload.get());
        assertTrue(ragData.path("matchedCount").asInt() > 0, "search_vet_knowledge must retrieve RAG docs");
    }

    @Test
    void scenario5_logFeedConsumption_convertsBagsTo50KgAndReturnsSignedHitlCardWithoutDbWrite() throws Exception {
        int feedBefore = feedRepository.findAllByCycleIdOrderByRecordDateDescIdDesc(cycleA1.getId()).size();

        mockAiServer.expect(requestTo(CHAT_URL))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess(
                        "{\"content\":\"\",\"toolCalls\":[{\"id\":\"call_feed_1\",\"type\":\"function\",\"function\":{\"name\":\"log_feed_consumption\",\"arguments\":\"{\\\"barn_name\\\":\\\"Nhà A1\\\",\\\"quantity\\\":2,\\\"unit\\\":\\\"bao\\\"}\"}}],\"provider\":\"llama-3.3-70b-versatile\",\"fallback\":false}",
                        MediaType.APPLICATION_JSON
                ));

        mvc.perform(post("/api/ai/assistant")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of(
                                "message", "cho nhà A1 ăn 2 bao cám",
                                "currentRoute", "/journal"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.actionType").value("LOG_FEED"))
                .andExpect(jsonPath("$.executed").value(false))
                .andExpect(jsonPath("$.requiresConfirmation").value(true))
                .andExpect(jsonPath("$.pendingAction.actionId").isNotEmpty())
                .andExpect(jsonPath("$.pendingAction.actionToken").isNotEmpty())
                .andExpect(jsonPath("$.pendingAction.payload.totalKg").value(50.0));

        mockAiServer.verify();
        assertEquals(feedBefore, feedRepository.findAllByCycleIdOrderByRecordDateDescIdDesc(cycleA1.getId()).size(),
                "Write tool MUST NOT write directly to DB before 2-step HITL confirmation");
    }

    @Test
    void scenario6_incompleteWriteCommand_asksOneConciseNaturalQuestion() throws Exception {
        // Case A: LLM asks directly without calling tool
        mockAiServer.expect(requestTo(CHAT_URL))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess(
                        "{\"content\":\"Bạn muốn ghi cám cho chuồng nào và số lượng bao nhiêu kg/bao?\",\"provider\":\"llama-3.3-70b-versatile\",\"fallback\":false}",
                        MediaType.APPLICATION_JSON
                ));

        mvc.perform(post("/api/ai/assistant")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of(
                                "message", "ghi cám giúp anh",
                                "currentRoute", "/journal"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.requiresConfirmation").value(false))
                .andExpect(jsonPath("$.reply", containsString("chuồng nào")))
                .andExpect(jsonPath("$.reply", not(containsString("Tôi chưa rõ bạn muốn thực hiện nghiệp vụ gì"))));

        mockAiServer.verify();
        mockAiServer.reset();

        // Case B: Even if LLM calls log_feed_consumption with missing args, backend asks 1 concise natural question
        mockAiServer.expect(requestTo(CHAT_URL))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess(
                        "{\"content\":\"\",\"toolCalls\":[{\"id\":\"call_feed_missing\",\"type\":\"function\",\"function\":{\"name\":\"log_feed_consumption\",\"arguments\":\"{}\"}}],\"provider\":\"llama-3.3-70b-versatile\",\"fallback\":false}",
                        MediaType.APPLICATION_JSON
                ));

        mvc.perform(post("/api/ai/assistant")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of(
                                "message", "ghi cám giúp anh",
                                "currentRoute", "/journal"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.actionType").value("CLARIFICATION_REQUIRED"))
                .andExpect(jsonPath("$.requiresConfirmation").value(false))
                .andExpect(jsonPath("$.reply").value("Bạn muốn ghi cám cho chuồng nào và số lượng bao nhiêu kg/bao?"));

        mockAiServer.verify();
    }

    @Test
    void scenario7_workerAskingFarmProfit_blockedAtTier0WithZeroFinancialLeakAndZeroLlmCall() throws Exception {
        // No mockAiServer expectations -> verifies LLM is NEVER even invoked for worker profit query
        String body = mvc.perform(post("/api/ai/assistant")
                        .with(user(workerAccount.getEmail()).authorities(new SimpleGrantedAuthority(RoleNames.FARM_WORKER)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of(
                                "message", "tháng này trại lãi bao nhiêu?",
                                "currentRoute", "/today-tasks"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.actionType").value("RBAC_BLOCKED"))
                .andExpect(jsonPath("$.executed").value(false))
                .andReturn().getResponse().getContentAsString();

        mockAiServer.verify();
        assertFalse(body.contains("45.000.000"));
        assertFalse(body.contains("57.000.000"));

        // Worker daily briefing ALSO strips supplierDebt & unassigned Nhà B2 before sending to LLM
        AtomicReference<String> workerDashJson = new AtomicReference<>();
        mockAiServer.expect(requestTo(CHAT_URL))
                .andExpect(method(HttpMethod.POST))
                .andExpect(req -> {
                    JsonNode sent = mapper.readTree(req.getBody().toString());
                    JsonNode tools = sent.path("tools");
                    for (JsonNode t : tools) {
                        assertNotEquals("get_financial_and_debts", t.path("function").path("name").asText(),
                                "Worker must NEVER receive get_financial_and_debts tool schema");
                    }
                })
                .andRespond(withSuccess(
                        "{\"content\":\"\",\"toolCalls\":[{\"id\":\"call_w_dash\",\"type\":\"function\",\"function\":{\"name\":\"get_dashboard_summary\",\"arguments\":\"{}\"}}],\"provider\":\"llama-3.3-70b-versatile\",\"fallback\":false}",
                        MediaType.APPLICATION_JSON
                ));
        mockAiServer.expect(requestTo(CHAT_URL))
                .andExpect(method(HttpMethod.POST))
                .andExpect(req -> {
                    JsonNode sent = mapper.readTree(req.getBody().toString());
                    workerDashJson.set(sent.path("toolMessages").get(1).path("content").asText());
                })
                .andRespond(withSuccess(
                        "{\"content\":\"Hôm nay Nhà A1 có việc cần làm, tổng đàn 1.500 con.\",\"provider\":\"llama-3.3-70b-versatile\",\"fallback\":false}",
                        MediaType.APPLICATION_JSON
                ));

        mvc.perform(post("/api/ai/assistant")
                        .with(user(workerAccount.getEmail()).authorities(new SimpleGrantedAuthority(RoleNames.FARM_WORKER)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of(
                                "message", "hôm nay có gì mới",
                                "currentRoute", "/today-tasks"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.actionType").value("DAILY_BRIEFING"));

        mockAiServer.verify();
        assertFalse(workerDashJson.get().contains("supplierDebtVnd"));
        assertFalse(workerDashJson.get().contains("Nhà B2"));
        assertTrue(workerDashJson.get().contains("Nhà A1"));
    }

    @Test
    void scenario8_highestSupplierDebt_executesGetFinancialAndDebtsMatchingDb() throws Exception {
        AtomicReference<String> turn2DebtPayload = new AtomicReference<>();

        mockAiServer.expect(requestTo(CHAT_URL))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess(
                        "{\"content\":\"\",\"toolCalls\":[{\"id\":\"call_debt_1\",\"type\":\"function\",\"function\":{\"name\":\"get_financial_and_debts\",\"arguments\":\"{\\\"scope\\\":\\\"supplier_debt\\\"}\"}}],\"provider\":\"gpt-4o-mini\",\"fallback\":false}",
                        MediaType.APPLICATION_JSON
                ));

        mockAiServer.expect(requestTo(CHAT_URL))
                .andExpect(method(HttpMethod.POST))
                .andExpect(req -> {
                    JsonNode sent = mapper.readTree(req.getBody().toString());
                    turn2DebtPayload.set(sent.path("toolMessages").get(1).path("content").asText());
                })
                .andRespond(withSuccess(
                        "{\"content\":\"Nhà cung cấp đang nợ nhiều nhất là NCC CP Việt Nam với số dư nợ 45.000.000 đ (1 hóa đơn).\",\"provider\":\"gpt-4o-mini\",\"fallback\":false}",
                        MediaType.APPLICATION_JSON
                ));

        String body = mvc.perform(post("/api/ai/assistant")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of(
                                "message", "nhà cung cấp nào mình đang nợ nhiều nhất?",
                                "currentRoute", "/purchases"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.actionType").value("QUERY_FARM_STATUS"))
                .andExpect(jsonPath("$.reply", containsString("NCC CP Việt Nam")))
                .andExpect(jsonPath("$.reply", containsString("45.000.000")))
                .andReturn().getResponse().getContentAsString();

        mockAiServer.verify();
        JsonNode debtData = mapper.readTree(turn2DebtPayload.get());
        assertEquals("NCC CP Việt Nam", debtData.path("supplierDebts").get(0).path("supplierName").asText());
        assertEquals(45_000_000L, debtData.path("supplierDebts").get(0).path("remainingDebtVnd").asLong());

        long logId = mapper.readTree(body).path("interactionId").asLong();
        AiInteractionLog stored = logRepository.findById(logId).orElseThrow();
        assertEquals("LLM_TOOL_CALL", stored.getHandlerTier());
        assertEquals("gpt-4o-mini", stored.getProvider());
    }

    @Test
    void tier2OfflineFallback_andPostLlmGuardrail_andIotRealtimeSkip() throws Exception {
        // 1. Offline LLM fallback (fallback=true) cleanly drops to Tier 2 DAILY_BRIEFING
        mockAiServer.expect(requestTo(CHAT_URL))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess(
                        "{\"content\":\"\",\"provider\":\"LOCAL_FALLBACK\",\"fallback\":true}",
                        MediaType.APPLICATION_JSON
                ));

        String offlineBody = mvc.perform(post("/api/ai/assistant")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of(
                                "message", "hôm nay có gì mới",
                                "currentRoute", "/dashboard"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.actionType").value("DAILY_BRIEFING"))
                .andExpect(jsonPath("$.reply", containsString("Nhà B2")))
                .andReturn().getResponse().getContentAsString();

        mockAiServer.verify();
        mockAiServer.reset();
        long offlineLogId = mapper.readTree(offlineBody).path("interactionId").asLong();
        AiInteractionLog offlineLog = logRepository.findById(offlineLogId).orElseThrow();
        assertEquals("LOCAL_DETERMINISTIC", offlineLog.getProvider());

        // 2. Post-LLM human drug leak guardrail blocks accidental Paracetamol mention in LLM_CHAT
        aiAssistantService.resetCircuitBreaker();
        mockAiServer.expect(requestTo(CHAT_URL))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess(
                        "{\"content\":\"Bạn có thể uống Paracetamol 500mg để hạ sốt.\",\"provider\":\"llama-3.3-70b-versatile\",\"fallback\":false}",
                        MediaType.APPLICATION_JSON
                ));

        mvc.perform(post("/api/ai/assistant")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of(
                                "message", "mệt quá làm sao cho khỏe",
                                "currentRoute", "/dashboard"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.actionType").value("OUT_OF_SCOPE_HUMAN_MEDICAL"));
        mockAiServer.verify();

        // 3. HIGH #2: RealtimeSyncInterceptor MUST skip /api/iot/telemetry (no STOMP broadcast, no AI cache eviction)
        RealtimeSyncService syncMock = mock(RealtimeSyncService.class);
        AiSecurityGuard guardMock = mock(AiSecurityGuard.class);
        RealtimeSyncInterceptor interceptor = new RealtimeSyncInterceptor(syncMock);
        ReflectionTestUtils.setField(interceptor, "aiSecurityGuard", guardMock);

        MockHttpServletRequest iotReq = new MockHttpServletRequest("POST", "/api/iot/telemetry");
        MockHttpServletResponse iotRes = new MockHttpServletResponse();
        iotRes.setStatus(200);
        interceptor.afterCompletion(iotReq, iotRes, new Object(), null);

        verify(syncMock, never()).broadcastDataChange(any(), any(), any(), any());
        verify(guardMock, never()).evictContextCache();
    }

    @Test
    void regression_workerBenignHomographsNotFalselyBlocked_andNavigationAndParallelToolsAndEmptyBarnAndValidation() throws Exception {
        // 1. Worker asking "Nhà A1 còn lại bao nhiêu con gà?" MUST NOT trigger false-positive RBAC_BLOCKED ("con lai bao nhieu")
        mockAiServer.expect(requestTo(CHAT_URL))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess(
                        "{\"content\":\"\",\"toolCalls\":[{\"id\":\"call_w_a1\",\"type\":\"function\",\"function\":{\"name\":\"get_barn_status\",\"arguments\":\"{\\\"barn_name\\\":\\\"Nhà A1\\\"}\"}}],\"provider\":\"gpt-4o-mini\",\"fallback\":false}",
                        MediaType.APPLICATION_JSON
                ));
        AtomicReference<String> barnStatusJson = new AtomicReference<>();
        mockAiServer.expect(requestTo(CHAT_URL))
                .andExpect(method(HttpMethod.POST))
                .andExpect(req -> {
                    JsonNode sent = mapper.readTree(req.getBody().toString());
                    barnStatusJson.set(sent.path("toolMessages").get(1).path("content").asText());
                })
                .andRespond(withSuccess(
                        "{\"content\":\"Nhà A1 hiện còn 1.500 con gà, nhiệt độ chuẩn 24.0 – 26.0°C.\",\"provider\":\"gpt-4o-mini\",\"fallback\":false}",
                        MediaType.APPLICATION_JSON
                ));

        mvc.perform(post("/api/ai/assistant")
                        .with(user(workerAccount.getEmail()).authorities(new SimpleGrantedAuthority(RoleNames.FARM_WORKER)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of(
                                "message", "Nhà A1 còn lại bao nhiêu con gà?",
                                "currentRoute", "/today-tasks"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.actionType").value("QUERY_FARM_STATUS"))
                .andExpect(jsonPath("$.reply", containsString("1.500")));
        mockAiServer.verify();
        mockAiServer.reset();
        // Verify get_barn_status includes targetTempRange from TEMPERATURE program step
        JsonNode barnStatusData = mapper.readTree(barnStatusJson.get());
        assertTrue(barnStatusData.path("barns").get(0).path("targetTempRange").asText("").contains("24"),
                "get_barn_status must include targetTempRange from farming program TEMPERATURE step");

        // 2. Parallel Read tool calls (2 calls in 1 LLM turn) execute BOTH and send 3 toolMessages (1 assistant + 2 tool) to Turn 2
        mockAiServer.expect(requestTo(CHAT_URL))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess(
                        "{\"content\":\"\",\"toolCalls\":["
                                + "{\"id\":\"call_vet_a\",\"type\":\"function\",\"function\":{\"name\":\"search_vet_knowledge\",\"arguments\":\"{\\\"query\\\":\\\"khò khè\\\"}\"}},"
                                + "{\"id\":\"call_vet_b\",\"type\":\"function\",\"function\":{\"name\":\"search_vet_knowledge\",\"arguments\":\"{\\\"query\\\":\\\"vẩy mỏ\\\"}\"}}"
                                + "],\"provider\":\"gpt-4o-mini\",\"fallback\":false}",
                        MediaType.APPLICATION_JSON
                ));
        mockAiServer.expect(requestTo(CHAT_URL))
                .andExpect(method(HttpMethod.POST))
                .andExpect(req -> {
                    JsonNode sent = mapper.readTree(req.getBody().toString());
                    JsonNode toolMsgs = sent.path("toolMessages");
                    assertEquals(3, toolMsgs.size(), "Parallel 2-tool call must produce 1 assistant + 2 tool messages");
                    assertEquals(2, toolMsgs.get(0).path("tool_calls").size());
                    assertEquals("call_vet_a", toolMsgs.get(1).path("tool_call_id").asText());
                    assertEquals("call_vet_b", toolMsgs.get(2).path("tool_call_id").asText());
                })
                .andRespond(withSuccess(
                        "{\"content\":\"Triệu chứng khò khè, vẩy mỏ gợi ý bệnh hô hấp CRD/ORT.\",\"provider\":\"gpt-4o-mini\",\"fallback\":false}",
                        MediaType.APPLICATION_JSON
                ));

        mvc.perform(post("/api/ai/assistant")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of(
                                "message", "gà con nở 30 ngày bị khò khè vẩy mỏ",
                                "currentRoute", "/dashboard"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.actionType").value("VET_DIAGNOSIS"))
                .andExpect(jsonPath("$.reply", containsString("MSG38")));
        mockAiServer.verify();
        mockAiServer.reset();

        // 3. Explicit screen navigation works instantaneously (<5ms, 0 LLM calls) even with llmFirstEnabled=true
        mvc.perform(post("/api/ai/assistant")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of(
                                "message", "Mở ghi nhật ký",
                                "currentRoute", "/dashboard"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.actionType").value("NAVIGATE_AND_PREFILL"))
                .andExpect(jsonPath("$.navigateTo").value("/journal"));
        mockAiServer.verify();

        // 4. Negative quantity on log_feed_consumption returns VALIDATION_ERROR (not CLARIFICATION_REQUIRED)
        mockAiServer.expect(requestTo(CHAT_URL))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess(
                        "{\"content\":\"\",\"toolCalls\":[{\"id\":\"call_neg\",\"type\":\"function\",\"function\":{\"name\":\"log_feed_consumption\",\"arguments\":\"{\\\"barn_name\\\":\\\"Nhà A1\\\",\\\"quantity\\\":-5,\\\"unit\\\":\\\"kg\\\"}\"}}],\"provider\":\"gpt-4o-mini\",\"fallback\":false}",
                        MediaType.APPLICATION_JSON
                ));
        mvc.perform(post("/api/ai/assistant")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of(
                                "message", "cho nhà A1 ăn -5 kg cám",
                                "currentRoute", "/journal"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.actionType").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.requiresConfirmation").value(false));
        mockAiServer.verify();
        mockAiServer.reset();

        // 5. complete_daily_task forwards LLM-extracted barn_name even when current message is short ("xong rồi")
        mockAiServer.expect(requestTo(CHAT_URL))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess(
                        "{\"content\":\"\",\"toolCalls\":[{\"id\":\"call_done_a1\",\"type\":\"function\",\"function\":{\"name\":\"complete_daily_task\",\"arguments\":\"{\\\"barn_name\\\":\\\"Nhà A1\\\",\\\"task_description\\\":\\\"cữ cám sáng\\\"}\"}}],\"provider\":\"gpt-4o-mini\",\"fallback\":false}",
                        MediaType.APPLICATION_JSON
                ));
        mvc.perform(post("/api/ai/assistant")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of(
                                "message", "xong rồi",
                                "currentRoute", "/today-tasks"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.actionType").value("COMPLETE_DAILY_TASKS"))
                .andExpect(jsonPath("$.requiresConfirmation").value(true))
                .andExpect(jsonPath("$.pendingAction.payload.barnName").value("Nhà A1"))
                .andExpect(jsonPath("$.pendingAction.payload.targetCycleId").value(cycleA1.getId()));
        mockAiServer.verify();
    }

    private ResultActions postJson(String url, Object body) throws Exception {
        return mvc.perform(post(url)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(body)))
                .andExpect(status().is2xxSuccessful());
    }

    private long id(ResultActions actions) throws Exception {
        JsonNode root = mapper.readTree(actions.andReturn().getResponse().getContentAsString());
        JsonNode data = root.has("data") ? root.get("data") : root;
        return data.get("id").asLong();
    }
}
