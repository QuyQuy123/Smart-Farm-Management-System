package com.farmshift.backendFarmShift;

import com.farmshift.backendFarmShift.repository.InventoryItemRepository;
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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Phiếu việc hằng ngày: định mức 1 con × số con còn lại → lượng cả chuồng; xác nhận thì trừ kho và ghi chi phí; hoàn tác thì hoàn lại.
 * Chuồng có 2 đàn 11 ngày tuổi: trống 1.000 con, mái 1.500 con.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@WithMockUser(username = "owner@farm.test", authorities = "ROLE_FARM_OWNER")
class DailyPlanIntegrationTest {
    private static final LocalDate TODAY = LocalDate.now();
    private static final LocalDate START = TODAY.minusDays(10);
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired InventoryItemRepository inventory;

    long feedItem, vaccineItem, medicineItem, bagUnit, vialUnit, plainUnit, plainItem, programId, barnId, cycleId, maleFlock, femaleFlock;

    @BeforeEach
    void setUp() throws Exception {
        long feedStore = id(send(post("/api/warehouse-categories"), Map.of("name", "Kho cám test")));
        long drugStore = id(send(post("/api/warehouse-categories"), Map.of("name", "Kho thuốc test")));
        bagUnit = id(send(post("/api/measurement-units"), Map.of("code", "BAO25T", "name", "Bao 25kg test", "contentQuantity", 25, "contentUnit", "KG")));
        vialUnit = id(send(post("/api/measurement-units"), Map.of("code", "LO1000T", "name", "Lọ 1000 liều test", "contentQuantity", 1000, "contentUnit", "DOSE")));
        long packUnit = id(send(post("/api/measurement-units"), Map.of("code", "GOI1T", "name", "Gói 1kg test", "contentQuantity", 1, "contentUnit", "KG")));
        plainUnit = id(send(post("/api/measurement-units"), Map.of("code", "THUNGT", "name", "Thùng test")));
        feedItem = id(send(post("/api/inventory-items"), Map.of("warehouseId", feedStore, "name", "Higro 02 test", "unitId", bagUnit, "price", 335000)));
        vaccineItem = id(send(post("/api/inventory-items"), Map.of("warehouseId", drugStore, "name", "Lasota test", "unitId", vialUnit, "price", 42000)));
        medicineItem = id(send(post("/api/inventory-items"), Map.of("warehouseId", drugStore, "name", "Men tiêu hóa test", "unitId", packUnit, "price", 85000)));
        plainItem = id(send(post("/api/inventory-items"), Map.of("warehouseId", feedStore, "name", "Cám không quy cách", "unitId", plainUnit, "price", 1000)));
        stock(feedItem, "100");
        stock(vaccineItem, "1");
        stock(medicineItem, "1");

        programId = id(send(post("/api/farming-programs"), program(feedItem)));
        long area = id(send(post("/api/farm-areas"), Map.of("name", "Khu phiếu việc")));
        barnId = id(send(post("/api/barns"), Map.of("areaId", area, "name", "Chuồng 1", "capacity", 50000, "areaM2", 1000)));
        cycleId = id(send(post("/api/barns/" + barnId + "/cycles"), Map.of("startDate", START.toString())));
        maleFlock = importFlock("Trống", "MALE", 1000);
        femaleFlock = importFlock("Mái", "FEMALE", 1500);
    }

    // ---------------------------------------------------------------- helpers

    private ResultActions send(MockHttpServletRequestBuilder request, Object body) throws Exception {
        return mvc.perform(request.contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(body)));
    }

    private long id(ResultActions result) throws Exception {
        JsonNode body = mapper.readTree(result.andExpect(status().is2xxSuccessful()).andReturn().getResponse().getContentAsString());
        return body.path("data").path("id").asLong();
    }

    private void stock(long itemId, String quantity) {
        var item = inventory.findById(itemId).orElseThrow();
        item.setStock(new BigDecimal(quantity));
        inventory.saveAndFlush(item);
    }

    private BigDecimal stockOf(long itemId) {
        return inventory.findById(itemId).orElseThrow().getStock();
    }

    private Map<String, Object> program(long feed) {
        Map<String, Object> feedStep = new HashMap<>(Map.of("category", "FEED", "name", "Cám choai", "dayFrom", 1, "dayTo", 90,
                "quantity", 80, "mealsPerDay", 4));
        feedStep.put("inventoryItemId", feed);
        return Map.of("name", "Gà Mía phiếu việc", "breed", "Gà Mía", "durationDays", 90, "steps", List.of(feedStep,
                Map.of("category", "VACCINE", "name", "Lasota lần 2", "dayFrom", 11, "dayTo", 11, "method", "EYE_NOSE",
                        "quantity", 1, "unit", "liều/con", "inventoryItemId", vaccineItem),
                Map.of("category", "MEDICINE", "name", "Men tiêu hóa", "dayFrom", 10, "dayTo", 12, "method", "MIX_FEED",
                        "quantity", 2, "unit", "g/kg cám", "inventoryItemId", medicineItem),
                Map.of("category", "TEMPERATURE", "name", "Úm tuần 2", "dayFrom", 8, "dayTo", 14, "tempMin", 29, "tempMax", 31),
                Map.of("category", "WORK", "name", "Vệ sinh máng uống", "dayFrom", 1, "dayTo", 90)));
    }

    private long importFlock(String name, String gender, int quantity) throws Exception {
        Map<String, Object> body = new HashMap<>(Map.of("name", name, "programId", programId, "gender", gender, "importDate", START.toString(),
                "ageAtImport", 1, "quantity", quantity, "avgWeight", 0.04, "unitPrice", 11000));
        return id(send(post("/api/cycles/" + cycleId + "/flocks"), body));
    }

    private String plan() { return "/api/cycles/" + cycleId + "/daily-plan"; }

    private ResultActions confirm(String key, Object actual, String note) throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("date", TODAY.toString());
        body.put("taskKey", key);
        if (actual != null) body.put("actualQuantity", actual);
        if (note != null) body.put("note", note);
        return send(post(plan() + "/tasks"), body);
    }

    private String feedKey(int meal) { return "FEED:I" + feedItem + ":M" + meal; }

    // ---------------------------------------------------------------- tests

    @Test
    void multipliesThePerBirdProgramByTheBirdsLeftInTheBarn() throws Exception {
        // 80 g x 2.500 birds = 200 kg a day, 4 meals of 50 kg = 2 bags of 25 kg.
        mvc.perform(get(plan()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.headcount").value(2500))
            .andExpect(jsonPath("$.data.flocks.length()").value(2))
            .andExpect(jsonPath("$.data.tasks[?(@.category == 'FEED')].key").value(contains(feedKey(1), feedKey(2), feedKey(3), feedKey(4))))
            .andExpect(jsonPath("$.data.tasks[?(@.key == '" + feedKey(1) + "')].plannedQuantity").value(50.0))
            .andExpect(jsonPath("$.data.tasks[?(@.key == '" + feedKey(1) + "')].plannedStock").value(2.0))
            .andExpect(jsonPath("$.data.tasks[?(@.key == '" + feedKey(1) + "')].stockUnit").value("Bao 25kg test"))
            .andExpect(jsonPath("$.data.tasks[?(@.key == '" + feedKey(1) + "')].doseText").value("80 g/con/ngày"))
            .andExpect(jsonPath("$.data.tasks[?(@.key == '" + feedKey(1) + "')].shares[*].plannedQuantity").value(contains(20.0, 30.0)))
            // Vaccine: 1 dose x 2.500 birds = 3 vials once opened; only 1 vial in stock.
            .andExpect(jsonPath("$.data.tasks[?(@.category == 'VACCINE')].plannedQuantity").value(2500.0))
            .andExpect(jsonPath("$.data.tasks[?(@.category == 'VACCINE')].plannedStock").value(3.0))
            .andExpect(jsonPath("$.data.tasks[?(@.category == 'VACCINE')].stockEnough").value(false))
            // Medicine: 2 g per kg of the 200 kg of feed = 400 g = 0,4 pack of 1 kg.
            .andExpect(jsonPath("$.data.tasks[?(@.category == 'MEDICINE')].plannedQuantity").value(400.0))
            .andExpect(jsonPath("$.data.tasks[?(@.category == 'MEDICINE')].plannedStock").value(0.4))
            .andExpect(jsonPath("$.data.tasks[?(@.category == 'TEMPERATURE')].tempMin").value(29))
            .andExpect(jsonPath("$.data.tasks[?(@.category == 'WORK')].name").value("Vệ sinh máng uống"))
            .andExpect(jsonPath("$.data.warnings", hasItem(containsString("Kho chỉ còn 1 Lọ 1000 liều test Lasota test"))));

        mvc.perform(get("/api/daily-plan")).andExpect(status().isOk())
            .andExpect(jsonPath("$.data[?(@.cycleId == " + cycleId + ")].barnName").value("Chuồng 1"));
    }

    @Test
    void confirmingAMealTakesTheFeedOutOfStockAndBooksItsCost() throws Exception {
        confirm(feedKey(1), null, null).andExpect(status().isOk())
            .andExpect(jsonPath("$.data.doneCount").value(1))
            .andExpect(jsonPath("$.data.tasks[?(@.key == '" + feedKey(1) + "')].done.actualQuantity").value(50.0))
            .andExpect(jsonPath("$.data.tasks[?(@.key == '" + feedKey(1) + "')].done.stockQuantity").value(2.0))
            .andExpect(jsonPath("$.data.tasks[?(@.key == '" + feedKey(1) + "')].done.cost").value(670000));
        org.assertj.core.api.Assertions.assertThat(stockOf(feedItem)).isEqualByComparingTo("98");
        // 335.000 đ per 25 kg bag = 13.400 đ/kg in the feed journal and the cycle's feed cost.
        mvc.perform(get("/api/cycles/" + cycleId))
            .andExpect(jsonPath("$.data.feedRecords[0].quantity").value(50.0))
            .andExpect(jsonPath("$.data.feedRecords[0].unitPrice").value(13400.0))
            .andExpect(jsonPath("$.data.finance.feedCost").value(670000));

        confirm(feedKey(1), null, null).andExpect(status().isConflict()).andExpect(jsonPath("$.errorCode").value("DAILY_TASK_ALREADY_DONE"));
        confirm("FEED:I" + feedItem + ":M9", null, null).andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errorCode").value("DAILY_TASK_NOT_FOUND"));
    }

    @Test
    void feedingDifferentFromThePlanNeedsAReason() throws Exception {
        confirm(feedKey(2), 40, null).andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errorCode").value("DAILY_TASK_NOTE_REQUIRED"))
            .andExpect(jsonPath("$.message").value(containsString("-20%")));
        // Within 10% of the plan no reason is needed.
        confirm(feedKey(3), 47, null).andExpect(status().isOk())
            .andExpect(jsonPath("$.data.tasks[?(@.key == '" + feedKey(3) + "')].done.deviated").value(false));
        confirm(feedKey(2), 40, "Gà bỏ ăn do nóng").andExpect(status().isOk())
            .andExpect(jsonPath("$.data.tasks[?(@.key == '" + feedKey(2) + "')].done.deviated").value(true))
            .andExpect(jsonPath("$.data.tasks[?(@.key == '" + feedKey(2) + "')].done.stockQuantity").value(1.6));
        org.assertj.core.api.Assertions.assertThat(stockOf(feedItem)).isEqualByComparingTo("96.52");
    }

    @Test
    void vaccinesUseWholeVialsAndAreBookedAsMedicineCost() throws Exception {
        String key = "VACCINE:I" + vaccineItem;
        confirm(key, null, null).andExpect(status().isBadRequest()).andExpect(jsonPath("$.errorCode").value("STOCK_NOT_ENOUGH"))
            .andExpect(jsonPath("$.message").value(containsString("cần 3")));
        stock(vaccineItem, "5");
        confirm(key, null, null).andExpect(status().isOk())
            .andExpect(jsonPath("$.data.tasks[?(@.key == '" + key + "')].done.stockQuantity").value(3.0))
            .andExpect(jsonPath("$.data.tasks[?(@.key == '" + key + "')].done.cost").value(126000));
        org.assertj.core.api.Assertions.assertThat(stockOf(vaccineItem)).isEqualByComparingTo("2");
        mvc.perform(get("/api/cycles/" + cycleId))
            .andExpect(jsonPath("$.data.finance.expenses.MEDICINE").value(126000));
    }

    @Test
    void lossesDuringTheDayShrinkTheMealsStillToCome() throws Exception {
        confirm(feedKey(1), null, null).andExpect(status().isOk());
        send(post("/api/flocks/" + femaleFlock + "/losses"), Map.of("type", "DEATH", "movementDate", TODAY.toString(), "quantity", 500))
            .andExpect(status().isCreated());
        // 2.000 birds left: 80 g x 2.000 / 4 meals = 40 kg; the meal already given keeps its 50 kg.
        mvc.perform(get(plan()))
            .andExpect(jsonPath("$.data.headcount").value(2000))
            .andExpect(jsonPath("$.data.tasks[?(@.key == '" + feedKey(1) + "')].done.actualQuantity").value(50.0))
            .andExpect(jsonPath("$.data.tasks[?(@.key == '" + feedKey(2) + "')].plannedQuantity").value(40.0));
        // Yesterday still counts the birds alive at the end of that day.
        mvc.perform(get(plan()).param("date", TODAY.minusDays(1).toString()))
            .andExpect(jsonPath("$.data.headcount").value(2500));
    }

    @Test
    void undoGivesTheStockBackAndRemovesTheBookedCost() throws Exception {
        confirm(feedKey(1), null, null).andExpect(status().isOk());
        long recordId = mapper.readTree(mvc.perform(get("/api/cycles/" + cycleId)).andReturn().getResponse().getContentAsString())
                .path("data").path("feedRecords").get(0).path("id").asLong();
        mvc.perform(delete("/api/cycles/" + cycleId + "/feed-records/" + recordId))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.errorCode").value("RECORD_FROM_DAILY_PLAN"));

        mvc.perform(delete(plan() + "/tasks").param("date", TODAY.toString()).param("taskKey", feedKey(1)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.doneCount").value(0));
        org.assertj.core.api.Assertions.assertThat(stockOf(feedItem)).isEqualByComparingTo("100");
        mvc.perform(get("/api/cycles/" + cycleId))
            .andExpect(jsonPath("$.data.feedRecords.length()").value(0))
            .andExpect(jsonPath("$.data.finance.feedCost").value(0));
    }

    @Test
    void workersConfirmWithoutSeeingMoneyAndOnlyUndoTheirOwnTasks() throws Exception {
        var worker = user("worker@farm.test").authorities(() -> "ROLE_FARM_WORKER");
        var other = user("other@farm.test").authorities(() -> "ROLE_FARM_WORKER");
        var accountant = user("ketoan@farm.test").authorities(() -> "ROLE_ACCOUNTANT");
        String medicine = "MEDICINE:I" + medicineItem;
        mvc.perform(post(plan() + "/tasks").with(worker).contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of("date", TODAY.toString(), "taskKey", medicine))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.tasks[?(@.key == '" + medicine + "')].done.doneBy").value("worker@farm.test"))
            .andExpect(jsonPath("$.data.tasks[?(@.key == '" + medicine + "')].done.cost").value(contains(nullValue())))
            .andExpect(jsonPath("$.data.doneCost").doesNotExist());
        org.assertj.core.api.Assertions.assertThat(stockOf(medicineItem)).isEqualByComparingTo("0.6");

        mvc.perform(delete(plan() + "/tasks").with(other).param("date", TODAY.toString()).param("taskKey", medicine))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.errorCode").value("DAILY_TASK_UNDO_FORBIDDEN"));
        mvc.perform(post(plan() + "/tasks").with(accountant).contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of("date", TODAY.toString(), "taskKey", "WORK:Nvệ sinh máng uống"))))
            .andExpect(status().isForbidden());
        mvc.perform(get(plan()).with(accountant)).andExpect(status().isOk())
            .andExpect(jsonPath("$.data.tasks[?(@.key == '" + medicine + "')].done.cost").value(34000));
        mvc.perform(delete(plan() + "/tasks").with(worker).param("date", TODAY.toString()).param("taskKey", medicine))
            .andExpect(status().isOk());
        org.assertj.core.api.Assertions.assertThat(stockOf(medicineItem)).isEqualByComparingTo("1");
    }

    @Test
    void temperatureAndWorkAreSimpleCheckmarks() throws Exception {
        confirm("WORK:Nvệ sinh máng uống", null, null).andExpect(status().isOk())
            .andExpect(jsonPath("$.data.tasks[?(@.category == 'WORK')].done.actualQuantity").value(contains(nullValue())));
        confirm("TEMPERATURE:Núm tuần 2", null, "31 độ lúc trưa").andExpect(status().isOk())
            .andExpect(jsonPath("$.data.doneCount").value(2));
    }

    @Test
    void programStepsOnlyLinkStockItemsThatCanBeConverted() throws Exception {
        Map<String, Object> noContent = new HashMap<>(program(plainItem));
        noContent.put("name", "Không quy cách");
        send(post("/api/farming-programs"), noContent).andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errorCode").value("PROGRAM_ITEM_NO_CONTENT"));
        Map<String, Object> mismatch = new HashMap<>(program(vaccineItem));
        mismatch.put("name", "Sai đơn vị");
        send(post("/api/farming-programs"), mismatch).andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errorCode").value("PROGRAM_ITEM_UNIT_MISMATCH"));

        mvc.perform(get("/api/farming-programs/" + programId))
            .andExpect(jsonPath("$.data.steps[?(@.category == 'FEED')].inventoryItemName").value("Higro 02 test"))
            .andExpect(jsonPath("$.data.steps[?(@.category == 'FEED')].inventoryUnitName").value("Bao 25kg test"));
        stock(feedItem, "0");
        mvc.perform(delete("/api/inventory-items/" + feedItem)).andExpect(status().isConflict())
            .andExpect(jsonPath("$.errorCode").value("INVENTORY_IN_USE"));
        // A pack size cannot change while the unit still has stock (it would change what the stock means).
        send(put("/api/measurement-units/" + vialUnit), Map.of("code", "LO1000T", "name", "Lọ 1000 liều test", "contentQuantity", 500, "contentUnit", "DOSE"))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.errorCode").value("UNIT_CONTENT_IN_USE"));
        mvc.perform(get("/api/inventory-items"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data[?(@.id == " + feedItem + ")].unitContentQuantity").value(25));
    }
}
