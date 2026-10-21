package com.farmshift.backendFarmShift;

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
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@WithMockUser(username = "owner@farm.test", authorities = "ROLE_FARM_OWNER")
public class AiAssistantIntegrationTest {

    private static final String ASSISTANT_API = "/api/ai/assistant";
    private static final String TRANSCRIBE_API = "/api/ai/transcribe";

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;

    @Autowired FarmAreaRepository areaRepository;
    @Autowired BarnRepository barnRepository;
    @Autowired FarmingCycleRepository cycleRepository;
    @Autowired FlockRepository flockRepository;
    @Autowired FeedRecordRepository feedRepository;
    @Autowired WeightSampleRepository weightRepository;
    @Autowired FlockMovementRepository movementRepository;
    @Autowired CycleExpenseRepository expenseRepository;
    @Autowired PurchaseInvoiceRepository invoiceRepository;
    @Autowired SupplierRepository supplierRepository;
    @Autowired InventoryItemRepository inventoryRepository;
    @Autowired ProductTypeRepository productTypeRepository;

    private Barn barnA1;
    private FarmingCycle cycleA1;
    private Flock flockA1;

    @BeforeEach
    void setUp() throws Exception {
        // Initialize an Area, Barn (Nhà A1), Active Cycle and Flock
        long areaId = id(postJson("/api/farm-areas", Map.of("name", "Khu Mía Thịt")));
        long barnId = id(postJson("/api/barns", Map.of("areaId", areaId, "name", "Nhà A1", "capacity", 5000, "areaM2", 400)));
        long progId = id(postJson("/api/farming-programs", Map.of("name", "Gà Mía thương phẩm", "breed", "Gà Mía", "durationDays", 90,
                "steps", List.of(Map.of("category", "FEED", "name", "Higro 01", "dayFrom", 1, "dayTo", 14, "quantity", 20, "mealsPerDay", 5)))));

        long cycleId = id(postJson("/api/barns/" + barnId + "/cycles", Map.of("startDate", LocalDate.now().minusDays(5).toString())));
        long flockId = id(postJson("/api/cycles/" + cycleId + "/flocks", Map.of(
                "name", "Đàn gà Nhà A1",
                "programId", progId,
                "gender", "MALE",
                "importDate", LocalDate.now().minusDays(5).toString(),
                "ageAtImport", 1,
                "quantity", 2000,
                "avgWeight", 0.04,
                "unitPrice", 11000,
                "sourceNote", "Dabaco"
        )));

        barnA1 = barnRepository.findById(barnId).orElseThrow();
        cycleA1 = cycleRepository.findById(cycleId).orElseThrow();
        flockA1 = flockRepository.findById(flockId).orElseThrow();
    }

    private ResultActions postJson(String url, Object body) throws Exception {
        return mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post(url)
                .contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(body)));
    }

    private long id(ResultActions result) throws Exception {
        String body = result.andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return mapper.readTree(body).path("data").path("id").asLong();
    }

    @Test
    void testVoiceCommandLogFeed_CreatesFeedRecordInDatabase() throws Exception {
        long initialFeeds = feedRepository.count();

        mvc.perform(post(ASSISTANT_API)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of(
                        "message", "Ghi cám cho Nhà A1 50 kg cám Higro 01",
                        "currentRoute", "/purchases",
                        "autoExecute", true
                ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.executed").value(true))
                .andExpect(jsonPath("$.actionType").value("LOG_FEED"))
                .andExpect(jsonPath("$.actionSummary.barnName").value("Nhà A1"))
                .andExpect(jsonPath("$.uiCommand").value("REFRESH_DATA"));

        assertEquals(initialFeeds + 1, feedRepository.count());
        List<FeedRecord> records = feedRepository.findAll();
        FeedRecord latest = records.get(records.size() - 1);
        assertEquals("Nhà A1", latest.getCycle().getBarn().getName());
        assertEquals(50.0, latest.getQuantityKg().doubleValue(), 0.001);
    }

    @Test
    void testVoiceCommandLogWeight_CreatesWeightSampleInDatabase() throws Exception {
        long initialWeights = weightRepository.count();

        mvc.perform(post(ASSISTANT_API)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of(
                        "message", "Cân mẫu Nhà A1 trung bình 1.45 kg mẫu 40 con",
                        "currentRoute", "/barns",
                        "autoExecute", true
                ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.executed").value(true))
                .andExpect(jsonPath("$.actionType").value("LOG_WEIGHT"))
                .andExpect(jsonPath("$.actionSummary.barnName").value("Nhà A1"))
                .andExpect(jsonPath("$.uiCommand").value("REFRESH_DATA"));

        assertEquals(initialWeights + 1, weightRepository.count());
        List<WeightSample> samples = weightRepository.findAll();
        WeightSample latest = samples.get(samples.size() - 1);
        assertEquals("Nhà A1", latest.getCycle().getBarn().getName());
        assertEquals(1.45, latest.getAvgWeightKg().doubleValue(), 0.001);
        assertEquals(40, latest.getSampleSize());
    }

    @Test
    void testVoiceCommandLogMortality_UpdatesFlockAndBarnQuantity() throws Exception {
        int initialBarnQty = barnA1.getCurrentQuantity();
        int initialFlockQty = flockA1.getQuantity();

        mvc.perform(post(ASSISTANT_API)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of(
                        "message", "Ghi nhận Nhà A1 hao hụt 2 con",
                        "currentRoute", "/journal",
                        "autoExecute", true
                ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.executed").value(true))
                .andExpect(jsonPath("$.actionType").value("LOG_MORTALITY"))
                .andExpect(jsonPath("$.actionSummary.barnName").value("Nhà A1"));

        Barn updatedBarn = barnRepository.findById(barnA1.getId()).orElseThrow();
        Flock updatedFlock = flockRepository.findById(flockA1.getId()).orElseThrow();

        assertEquals(initialBarnQty - 2, updatedBarn.getCurrentQuantity());
        assertEquals(initialFlockQty - 2, updatedFlock.getQuantity());
    }

    @Test
    void testVoiceCommandNavigate_ReturnsCorrectRoute() throws Exception {
        mvc.perform(post(ASSISTANT_API)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of(
                        "message", "Mở màn hình hóa đơn nhập hàng",
                        "currentRoute", "/barns",
                        "autoExecute", true
                ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.executed").value(true))
                .andExpect(jsonPath("$.actionType").value("NAVIGATE_AND_PREFILL"))
                .andExpect(jsonPath("$.navigateTo").value("/purchases"));
    }

    @Test
    void testTranscribeEndpoint_HandlesMissingKeyGracefully() throws Exception {
        MockMultipartFile audioFile = new MockMultipartFile(
                "file",
                "test_audio.webm",
                "audio/webm",
                new byte[]{0x1A, 0x45, (byte) 0xDF, (byte) 0xA3}
        );

        mvc.perform(multipart(TRANSCRIBE_API).file(audioFile))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fallback").isBoolean())
                .andExpect(jsonPath("$.provider").isNotEmpty());
    }

    @Test
    void testWorkerRole_RejectsFinancialExpenseCommand() throws Exception {
        mvc.perform(post(ASSISTANT_API)
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user("worker@farm.test")
                        .authorities(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_FARM_WORKER")))
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of(
                        "message", "Ghi chi phí tiền điện Nhà A1 500 nghìn",
                        "currentRoute", "/purchases",
                        "autoExecute", true
                ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.executed").value(false))
                .andExpect(jsonPath("$.reply", org.hamcrest.Matchers.containsString("Tài khoản Công nhân không có quyền")));
    }

    @Test
    void testUnknownBarn_ReturnsHelpfulMessageWithoutCrashing() throws Exception {
        mvc.perform(post(ASSISTANT_API)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of(
                        "message", "Ghi cám cho chuồng Z9 50 kg cám Higro 01",
                        "currentRoute", "/barns",
                        "autoExecute", true
                ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.executed").value(false))
                .andExpect(jsonPath("$.reply", org.hamcrest.Matchers.containsString("Không tìm thấy chuồng")));
    }

    @Test
    void testVoiceCommandLogFeed_WithBagsConversion() throws Exception {
        mvc.perform(post(ASSISTANT_API)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of(
                        "message", "Cho chuồng A1 ăn 2 bao cám giai đoạn 2",
                        "currentRoute", "/journal",
                        "autoExecute", true
                ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.executed").value(true))
                .andExpect(jsonPath("$.actionType").value("LOG_FEED"))
                .andExpect(jsonPath("$.actionSummary.barnName").value("Nhà A1"))
                .andExpect(jsonPath("$.actionSummary.detail", org.hamcrest.Matchers.containsString("50.0 kg")));

        List<FeedRecord> records = feedRepository.findAll();
        FeedRecord latest = records.get(records.size() - 1);
        assertEquals(50.0, latest.getQuantityKg().doubleValue(), 0.001);
    }

    @Test
    void testVoiceCommandLogExpense_OwnerRole_CreatesExpenseInDatabase() throws Exception {
        long initialCount = expenseRepository.count();

        mvc.perform(post(ASSISTANT_API)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of(
                        "message", "Ghi chi phí tiền điện Nhà A1 500 nghìn",
                        "currentRoute", "/cashbook",
                        "autoExecute", true
                ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.executed").value(true))
                .andExpect(jsonPath("$.actionType").value("LOG_EXPENSE"))
                .andExpect(jsonPath("$.actionSummary.barnName").value("Nhà A1"));

        assertEquals(initialCount + 1, expenseRepository.count());
        List<CycleExpense> list = expenseRepository.findAll();
        CycleExpense latest = list.get(list.size() - 1);
        assertEquals(ExpenseCategory.ELECTRICITY, latest.getCategory());
        assertEquals(500000L, latest.getAmount().longValue());
    }

    @Test
    void testVoiceCommandImportStock_ExecutesStockImport() throws Exception {
        ProductType pt = new ProductType();
        pt.setName("Thức ăn chăn nuôi");
        pt.setNameKey("thức ăn chăn nuôi");
        pt = productTypeRepository.saveAndFlush(pt);

        Supplier supplier = new Supplier();
        supplier.setName("Công ty Thức ăn CP");
        supplier.setNameKey("công ty thức ăn cp");
        supplier.setRepresentative("Nguyễn Văn A");
        supplier.setPhone("0987654321");
        supplier.setProductType(pt);
        supplier = supplierRepository.saveAndFlush(supplier);

        PurchaseInvoice invoice = new PurchaseInvoice();
        invoice.setCode("NH000088");
        invoice.setSupplier(supplier);
        invoice.setInvoiceDate(LocalDate.now());
        invoice.setStockStatus("Chưa nhập kho");
        invoice.setPaymentStatus("Chưa thanh toán");
        invoice.setTotalAmount(2000000L);
        invoice.setPaidAmount(0L);
        invoice = invoiceRepository.saveAndFlush(invoice);

        mvc.perform(post(ASSISTANT_API)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of(
                        "message", "Xác nhận nhập kho đơn hàng NH000088",
                        "currentRoute", "/purchases",
                        "autoExecute", true
                ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.executed").value(true))
                .andExpect(jsonPath("$.actionType").value("IMPORT_PURCHASE_STOCK"));

        PurchaseInvoice updated = invoiceRepository.findById(invoice.getId()).orElseThrow();
        assertEquals("Đã nhập kho", updated.getStockStatus());
    }

    @Test
    void testVoiceCommandQueryFarmStatus_ReturnsStatus() throws Exception {
        mvc.perform(post(ASSISTANT_API)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of(
                        "message", "Tình trạng Nhà A1 thế nào?",
                        "currentRoute", "/barns",
                        "autoExecute", true
                ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.actionType").value("QUERY_FARM_STATUS"))
                .andExpect(jsonPath("$.reply", org.hamcrest.Matchers.containsString("Nhà A1")));
    }

    @Test
    void testVoiceCommandVetDiagnosis_ReturnsDiseaseProtocol() throws Exception {
        mvc.perform(post(ASSISTANT_API)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of(
                        "message", "Gà thở khò khè, vươn cổ ngáp",
                        "currentRoute", "/journal",
                        "autoExecute", true
                ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.actionType").value("VET_DIAGNOSIS"))
                .andExpect(jsonPath("$.reply", org.hamcrest.Matchers.containsString("hô hấp")));
    }

    @Test
    void testVoiceCommandNavigateAndPrefill_OpensPurchaseModalWithPrefill() throws Exception {
        mvc.perform(post(ASSISTANT_API)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of(
                        "message", "Tạo đơn nhập hàng từ công ty Dabaco",
                        "currentRoute", "/purchases",
                        "autoExecute", true
                ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.actionType").value("NAVIGATE_AND_PREFILL"))
                .andExpect(jsonPath("$.navigateTo").value("/purchases"))
                .andExpect(jsonPath("$.uiCommand").value("OPEN_CREATE_PURCHASE_MODAL"))
                .andExpect(jsonPath("$.prefillData.supplierName", org.hamcrest.Matchers.containsString("Dabaco")));
    }

    @Test
    void testVoiceCommandActiveCycleNotFound_ReturnsHelpfulMessage() throws Exception {
        long areaId = barnA1.getArea().getId();
        long emptyBarnId = id(postJson("/api/barns", Map.of("areaId", areaId, "name", "Nhà Trống B9", "capacity", 3000, "areaM2", 200)));

        mvc.perform(post(ASSISTANT_API)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of(
                        "message", "Ghi cám cho Nhà Trống B9 50 kg cám Higro 01",
                        "currentRoute", "/journal",
                        "autoExecute", true
                ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.executed").value(false))
                .andExpect(jsonPath("$.reply", org.hamcrest.Matchers.containsString("chưa có lứa nuôi hoạt động")));
    }

    @Test
    void testVoiceCommandContextAwareBarnResolution_LogsFeedWithoutExplicitBarnName() throws Exception {
        // User is viewing /barns/{id} of barnA1 and says "Cho an 40 kg cam Higro 01" without saying "Nhà A1"
        mvc.perform(post(ASSISTANT_API)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of(
                        "message", "Cho an 40 kg cam Higro 01",
                        "currentRoute", "/barns/" + barnA1.getId(),
                        "autoExecute", true
                ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.executed").value(true))
                .andExpect(jsonPath("$.actionType").value("LOG_FEED"))
                .andExpect(jsonPath("$.actionSummary.barnName").value("Nhà A1"))
                .andExpect(jsonPath("$.actionSummary.kg").value("40.0"));

        List<FeedRecord> records = feedRepository.findAllByCycleIdOrderByRecordDateDescIdDesc(cycleA1.getId());
        assertFalse(records.isEmpty());
        assertEquals(0, records.get(0).getQuantityKg().compareTo(java.math.BigDecimal.valueOf(40.0)));
    }

    @Test
    void testVoiceCommandWithHistory_HandlesMultiTurnConversation() throws Exception {
        List<Map<String, String>> history = List.of(
                Map.of("role", "user", "content", "Nhiệt độ hôm nay thế nào?"),
                Map.of("role", "assistant", "content", "Nhiệt độ các chuồng ổn định 28 độ C.")
        );

        mvc.perform(post(ASSISTANT_API)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of(
                        "message", "Vậy độ ẩm thì sao?",
                        "currentRoute", "/dashboard",
                        "history", history,
                        "autoExecute", true
                ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reply").isString());
    }

    @Test
    void testVoiceCommandCompleteDailyTasks_SuccessfullyConfirmsTodayTasks() throws Exception {
        mvc.perform(post(ASSISTANT_API)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of(
                        "message", "Việc hôm nay đã làm xong",
                        "currentRoute", "/today-tasks",
                        "autoExecute", true
                ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.executed").value(true))
                .andExpect(jsonPath("$.actionType").value("COMPLETE_DAILY_TASKS"))
                .andExpect(jsonPath("$.uiCommand").value("REFRESH_DATA"))
                .andExpect(jsonPath("$.reply", org.hamcrest.Matchers.containsString("Đã xác nhận hoàn thành")));

        // Calling it again should acknowledge that all tasks were already completed
        mvc.perform(post(ASSISTANT_API)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of(
                        "message", "Việc hôm nay đã làm xong",
                        "currentRoute", "/today-tasks",
                        "autoExecute", true
                ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.executed").value(true))
                .andExpect(jsonPath("$.actionType").value("COMPLETE_DAILY_TASKS"))
                .andExpect(jsonPath("$.reply", org.hamcrest.Matchers.containsString("đã được xác nhận hoàn thành trước đó")));
    }

    @Test
    void testAllTenUserScenarios_WithConfirmationAndExecution() throws Exception {
        // 1. Tạo Chuồng nuôi mới: "Tạo chuồng B1 diện tích 600m2"
        String barnRes = mvc.perform(post(ASSISTANT_API)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of(
                        "message", "Tạo chuồng B1 diện tích 600m2",
                        "autoExecute", false
                ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.actionType").value("CREATE_BARN"))
                .andExpect(jsonPath("$.requiresConfirmation").value(true))
                .andExpect(jsonPath("$.pendingAction.payload.name").value("Nhà B1"))
                .andExpect(jsonPath("$.pendingAction.payload.floorArea").value(600.0))
                .andExpect(jsonPath("$.pendingAction.payload.capacity").value(4800))
                .andReturn().getResponse().getContentAsString();

        JsonNode barnPayload = mapper.readTree(barnRes).path("pendingAction").path("payload");
        mvc.perform(post(ASSISTANT_API)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of(
                        "confirmAction", true,
                        "pendingActionPayload", mapper.convertValue(barnPayload, Map.class)
                ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.executed").value(true))
                .andExpect(jsonPath("$.actionType").value("CREATE_BARN"));
        assertTrue(barnRepository.findAll().stream().anyMatch(b -> b.getName().equalsIgnoreCase("Nhà B1")));

        // 2. Thêm Nhà cung cấp: "Thêm nhà cung cấp cám CP 0912345678"
        String suppRes = mvc.perform(post(ASSISTANT_API)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of(
                        "message", "Thêm nhà cung cấp cám CP 0912345678",
                        "autoExecute", false
                ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.actionType").value("CREATE_SUPPLIER"))
                .andExpect(jsonPath("$.requiresConfirmation").value(true))
                .andExpect(jsonPath("$.pendingAction.payload.name").value("Cám CP"))
                .andExpect(jsonPath("$.pendingAction.payload.phone").value("0912345678"))
                .andReturn().getResponse().getContentAsString();

        JsonNode suppPayload = mapper.readTree(suppRes).path("pendingAction").path("payload");
        mvc.perform(post(ASSISTANT_API)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of(
                        "confirmAction", true,
                        "pendingActionPayload", mapper.convertValue(suppPayload, Map.class)
                ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.executed").value(true));
        assertTrue(supplierRepository.findAll().stream().anyMatch(s -> s.getName().equalsIgnoreCase("Cám CP")));

        // 3. Thêm Khu vực nuôi: "Thêm khu vực Khu Nuôi Gà Thịt"
        String areaRes = mvc.perform(post(ASSISTANT_API)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of(
                        "message", "Thêm khu vực Khu Nuôi Gà Thịt",
                        "autoExecute", false
                ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.actionType").value("CREATE_AREA"))
                .andExpect(jsonPath("$.requiresConfirmation").value(true))
                .andExpect(jsonPath("$.pendingAction.payload.name", org.hamcrest.Matchers.containsString("Khu Nuôi Gà Thịt")))
                .andReturn().getResponse().getContentAsString();

        JsonNode areaPayload = mapper.readTree(areaRes).path("pendingAction").path("payload");
        mvc.perform(post(ASSISTANT_API)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of(
                        "confirmAction", true,
                        "pendingActionPayload", mapper.convertValue(areaPayload, Map.class)
                ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.executed").value(true));
        assertTrue(areaRepository.findAll().stream().anyMatch(a -> a.getName().equalsIgnoreCase("Khu Nuôi Gà Thịt")));

        // 4. Ghi cám chuồng: "Ghi cám Nhà A1 50kg"
        mvc.perform(post(ASSISTANT_API)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of(
                        "message", "Ghi cám Nhà A1 50kg",
                        "autoExecute", false
                ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.actionType").value("LOG_FEED"))
                .andExpect(jsonPath("$.requiresConfirmation").value(true))
                .andExpect(jsonPath("$.pendingAction.payload.totalKg").value(50.0));

        // 5. Ghi cân mẫu: "Cân mẫu Nhà A1 1.5kg"
        mvc.perform(post(ASSISTANT_API)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of(
                        "message", "Cân mẫu Nhà A1 1.5kg",
                        "autoExecute", false
                ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.actionType").value("LOG_WEIGHT"))
                .andExpect(jsonPath("$.requiresConfirmation").value(true))
                .andExpect(jsonPath("$.pendingAction.payload.avgWeight").value(1.5));

        // 6. Báo hao hụt: "Báo hao hụt 5 con chuồng A1 do dịch"
        mvc.perform(post(ASSISTANT_API)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of(
                        "message", "Báo hao hụt 5 con chuồng A1 do dịch",
                        "autoExecute", false
                ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.actionType").value("LOG_MORTALITY"))
                .andExpect(jsonPath("$.requiresConfirmation").value(true))
                .andExpect(jsonPath("$.pendingAction.payload.quantity").value(5))
                .andExpect(jsonPath("$.pendingAction.payload.reason", org.hamcrest.Matchers.containsString("dịch bệnh")));

        // 7. Ghi chi phí: "Ghi chi phí chuồng A1 500k tiền điện"
        mvc.perform(post(ASSISTANT_API)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of(
                        "message", "Ghi chi phí chuồng A1 500k tiền điện",
                        "autoExecute", false
                ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.actionType").value("LOG_EXPENSE"))
                .andExpect(jsonPath("$.requiresConfirmation").value(true))
                .andExpect(jsonPath("$.pendingAction.payload.category").value("ELECTRICITY"))
                .andExpect(jsonPath("$.pendingAction.payload.amount").value(500000));

        // 8. Nhập kho đơn hàng: "Nhận kho đơn NH000003"
        ProductType pt = productTypeRepository.findAll().stream().findFirst().orElseGet(() -> {
            ProductType newPt = new ProductType();
            newPt.setName("Thức ăn chăn nuôi");
            newPt.setNameKey("thức ăn chăn nuôi");
            return productTypeRepository.saveAndFlush(newPt);
        });

        Supplier testSupplier = supplierRepository.findAll().stream().findFirst().orElseGet(() -> {
            Supplier s = new Supplier();
            s.setName("Công ty CP");
            s.setNameKey("công ty cp");
            s.setRepresentative("Nguyễn Văn A");
            s.setPhone("0987654321");
            s.setProductType(pt);
            return supplierRepository.saveAndFlush(s);
        });

        PurchaseInvoice inv3 = new PurchaseInvoice();
        inv3.setCode("NH000003");
        inv3.setSupplier(testSupplier);
        inv3.setInvoiceDate(LocalDate.now());
        inv3.setStockStatus("Chưa nhập kho");
        inv3.setPaymentStatus("Chưa thanh toán");
        inv3.setTotalAmount(3500000L);
        inv3.setPaidAmount(0L);
        invoiceRepository.saveAndFlush(inv3);

        mvc.perform(post(ASSISTANT_API)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of(
                        "message", "Nhận kho đơn NH000003",
                        "autoExecute", false
                ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.actionType").value("IMPORT_PURCHASE_STOCK"))
                .andExpect(jsonPath("$.requiresConfirmation").value(true))
                .andExpect(jsonPath("$.pendingAction.payload.invoiceCode").value("NH000003"));

        // 9. Hoàn thành việc ngày: "Xong việc hôm nay"
        mvc.perform(post(ASSISTANT_API)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of(
                        "message", "Xong việc hôm nay",
                        "autoExecute", false
                ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.actionType").value("COMPLETE_DAILY_TASKS"))
                .andExpect(jsonPath("$.requiresConfirmation").value(true));

        // 10. Hỏi đáp & Tra cứu: "Gà thở khò khè" (Thú y) và "Tồn kho cám CP?" (Tồn kho)
        mvc.perform(post(ASSISTANT_API)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of(
                        "message", "Gà thở khò khè",
                        "autoExecute", false
                ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.actionType").value("VET_DIAGNOSIS"))
                .andExpect(jsonPath("$.executed").value(false))
                .andExpect(jsonPath("$.requiresConfirmation").value(false))
                .andExpect(jsonPath("$.reply", org.hamcrest.Matchers.containsString("CRD")));

        mvc.perform(post(ASSISTANT_API)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of(
                        "message", "Tồn kho cám CP?",
                        "autoExecute", false
                ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.actionType").value("QUERY_FARM_STATUS"))
                .andExpect(jsonPath("$.executed").value(false))
                .andExpect(jsonPath("$.requiresConfirmation").value(false))
                .andExpect(jsonPath("$.reply", org.hamcrest.Matchers.containsString("Tồn kho thức ăn")));
    }
}
