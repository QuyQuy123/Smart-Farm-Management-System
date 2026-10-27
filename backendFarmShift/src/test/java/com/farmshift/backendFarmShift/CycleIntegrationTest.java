package com.farmshift.backendFarmShift;

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
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.closeTo;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@WithMockUser(username = "owner@farm.test", authorities = "ROLE_FARM_OWNER")
class CycleIntegrationTest {
    private static final LocalDate TODAY = LocalDate.now();
    private static final LocalDate START = TODAY.minusDays(10);
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired com.farmshift.backendFarmShift.repository.AccountRepository accounts;
    @Autowired com.farmshift.backendFarmShift.repository.RoleRepository roles;
    long areaId;
    long barnId;
    long programId;

    @BeforeEach
    void setUp() throws Exception {
        areaId = id(post("/api/farm-areas", Map.of("name", "Khu Mía Thịt")));
        barnId = barn("Nhà A3", 50000);
        programId = id(post("/api/farming-programs", Map.of("name", "Gà Mía thương phẩm", "breed", "Gà Mía", "durationDays", 90,
                "steps", List.of(
                        Map.of("category", "FEED", "name", "Higro 01", "dayFrom", 1, "dayTo", 14, "quantity", 20, "mealsPerDay", 5),
                        Map.of("category", "FEED", "name", "Higro 02", "dayFrom", 15, "dayTo", 90, "quantity", 80, "mealsPerDay", 3),
                        Map.of("category", "VACCINE", "name", "Lasota lần 1", "dayFrom", 5, "dayTo", 5, "method", "EYE_NOSE"),
                        Map.of("category", "VACCINE", "name", "Gumboro", "dayFrom", 11, "dayTo", 11, "method", "MOUTH"),
                        Map.of("category", "VACCINE", "name", "Lasota lần 2", "dayFrom", 21, "dayTo", 21, "method", "EYE_NOSE"),
                        Map.of("category", "MEDICINE", "name", "Men tiêu hóa", "dayFrom", 10, "dayTo", 12, "method", "MIX_FEED",
                                "quantity", 2, "unit", "g/kg cám"),
                        Map.of("category", "TEMPERATURE", "name", "Úm", "dayFrom", 1, "dayTo", 14, "tempMin", 28, "tempMax", 32)))));
    }

    // ---------------------------------------------------------------- helpers

    private ResultActions post(String url, Object body) throws Exception {
        return mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post(url)
                .contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(body)));
    }

    private long workerAccount(String email) {
        var role = roles.findByName("ROLE_FARM_WORKER").orElseGet(() -> roles.save(new com.farmshift.backendFarmShift.entity.Role(null, "ROLE_FARM_WORKER", "Công nhân")));
        var account = new com.farmshift.backendFarmShift.entity.Account();
        account.setEmail(email);
        account.setPassword("x");
        account.setFullName(email);
        account.setRole(role);
        account.setIsActive(true);
        return accounts.save(account).getId();
    }

    private long id(ResultActions result) throws Exception {
        String body = result.andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return mapper.readTree(body).path("data").path("id").asLong();
    }

    private long barn(String name, int capacity) throws Exception {
        return id(post("/api/barns", Map.of("areaId", areaId, "name", name,
                "capacity", capacity, "areaM2", 1000)));
    }

    private long startCycle(long barn, LocalDate start) throws Exception {
        return id(post("/api/barns/" + barn + "/cycles", Map.of("startDate", start.toString())));
    }

    private Map<String, Object> flock(String name, String gender, LocalDate date, int quantity) {
        Map<String, Object> body = new HashMap<>();
        body.put("name", name);
        body.put("programId", programId);
        body.put("gender", gender);
        body.put("importDate", date.toString());
        body.put("ageAtImport", 1);
        body.put("quantity", quantity);
        body.put("avgWeight", 0.04);
        body.put("unitPrice", 11000);
        body.put("sourceNote", "Dabaco");
        return body;
    }

    private long importFlock(long cycle, String name, String gender, LocalDate date, int quantity) throws Exception {
        return id(post("/api/cycles/" + cycle + "/flocks", flock(name, gender, date, quantity)));
    }

    private JsonNode detail(long cycle) throws Exception {
        String body = mvc.perform(get("/api/cycles/" + cycle)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return mapper.readTree(body).path("data");
    }

    // ---------------------------------------------------------------- tests

    @Test
    void declaresCycleAndImportsMaleFemaleFlocksWithinThreeDays() throws Exception {
        long cycle = startCycle(barnId, START);
        mvc.perform(get("/api/barns/" + barnId)).andExpect(jsonPath("$.data.status").value("ACTIVE"))
            .andExpect(jsonPath("$.data.activeCycleId").value(cycle));
        post("/api/barns/" + barnId + "/cycles", Map.of("startDate", START.toString()))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.errorCode").value("CYCLE_ALREADY_ACTIVE"));

        importFlock(cycle, "MÍA-DABACO TRỐNG", "MALE", START, 20000);
        importFlock(cycle, "MÍA-DABACO MÁI", "FEMALE", START.plusDays(3), 10000);
        post("/api/cycles/" + cycle + "/flocks", flock("MÍA XÔ", "MIXED", START.plusDays(4), 100))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errorCode").value("FLOCK_IMPORT_WINDOW"));
        post("/api/cycles/" + cycle + "/flocks", flock("MÍA XÔ", "MIXED", START.minusDays(1), 100))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errorCode").value("CYCLE_DATE_OUT_OF_RANGE"));
        post("/api/cycles/" + cycle + "/flocks", flock("MÍA XÔ", "MIXED", START.plusDays(2), 20001))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errorCode").value("FLOCK_OVER_CAPACITY"));
        Map<String, Object> noGender = flock("MÍA XÔ", "MIXED", START, 10);
        noGender.remove("gender");
        post("/api/cycles/" + cycle + "/flocks", noGender).andExpect(status().isBadRequest());

        JsonNode data = detail(cycle);
        JsonNode metrics = data.path("metrics");
        org.junit.jupiter.api.Assertions.assertEquals(30000, metrics.path("totalIn").asInt());
        org.junit.jupiter.api.Assertions.assertEquals(30000, metrics.path("currentQuantity").asInt());
        org.junit.jupiter.api.Assertions.assertEquals(11, metrics.path("dayOfCycle").asInt());
        org.junit.jupiter.api.Assertions.assertEquals(START.plusDays(3).toString(), metrics.path("importDeadline").asText());
        org.junit.jupiter.api.Assertions.assertEquals("MALE", data.path("flocks").get(0).path("gender").asText());
        org.junit.jupiter.api.Assertions.assertEquals(11, data.path("flocks").get(0).path("currentAgeDays").asInt());
        org.junit.jupiter.api.Assertions.assertTrue(data.path("flocks").get(0).path("currentAgeWeeks").isMissingNode());
        org.junit.jupiter.api.Assertions.assertEquals(330000000, data.path("finance").path("chickCost").asLong());
        mvc.perform(get("/api/barns/" + barnId)).andExpect(jsonPath("$.data.currentQuantity").value(30000));
    }

    @Test
    void computesFcrDensityAndCostsFromJournal() throws Exception {
        long cycle = startCycle(barnId, START);
        importFlock(cycle, "Gà Mía", "MIXED", START, 1000);
        post("/api/cycles/" + cycle + "/feed-records", Map.of("recordDate", START.plusDays(1).toString(), "feedName", "Higro 01",
                "quantityKg", 900, "unitPrice", 13000)).andExpect(status().isCreated());
        post("/api/cycles/" + cycle + "/weight-samples", Map.of("sampleDate", TODAY.toString(), "avgWeightKg", 0.64, "sampleSize", 50))
            .andExpect(status().isCreated());
        post("/api/cycles/" + cycle + "/expenses", Map.of("expenseDate", TODAY.toString(), "category", "ELECTRICITY", "amount", 500000))
            .andExpect(status().isCreated());
        post("/api/cycles/" + cycle + "/feed-records", Map.of("recordDate", TODAY.plusDays(1).toString(), "feedName", "Higro 01",
                "quantityKg", 1, "unitPrice", 1)).andExpect(status().isBadRequest()).andExpect(jsonPath("$.errorCode").value("CYCLE_DATE_OUT_OF_RANGE"));

        mvc.perform(get("/api/cycles/" + cycle)).andExpect(status().isOk())
            // biomass 1000 x 0.64 = 640 kg, gain 640 - 40 = 600 kg, FCR 900 / 600 = 1.5
            .andExpect(jsonPath("$.data.metrics.biomassKg").value(closeTo(640.0, 0.01)))
            .andExpect(jsonPath("$.data.metrics.weightGainKg").value(closeTo(600.0, 0.01)))
            .andExpect(jsonPath("$.data.metrics.fcr").value(closeTo(1.5, 0.001)))
            .andExpect(jsonPath("$.data.metrics.densityPerM2").value(closeTo(1.0, 0.01)))
            // 11,000,000 chicks + 11,700,000 feed + 500,000 electricity
            .andExpect(jsonPath("$.data.finance.totalCost").value(23200000))
            .andExpect(jsonPath("$.data.finance.costPerKg").value(36250))
            .andExpect(jsonPath("$.data.finance.costPerHead").value(23200))
            .andExpect(jsonPath("$.data.finance.expenses.ELECTRICITY").value(500000))
            .andExpect(jsonPath("$.data.feedRecords[0].createdBy").value("owner@farm.test"));
    }

    @Test
    void transfersPartOfFlockToAnotherRunningBarnKeepingAgeAndCost() throws Exception {
        long cycle = startCycle(barnId, START);
        long flockId = importFlock(cycle, "Gà Mía", "FEMALE", START, 1000);
        long target = barn("Nhà A4", 300);
        Map<String, Object> transfer = new HashMap<>(Map.of("targetBarnId", target, "quantity", 200, "transferDate", TODAY.toString()));
        post("/api/flocks/" + flockId + "/transfer", transfer)
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errorCode").value("TRANSFER_TARGET_NO_CYCLE"));

        long targetCycle = startCycle(target, START.plusDays(5));
        transfer.put("quantity", 301);
        post("/api/flocks/" + flockId + "/transfer", transfer)
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errorCode").value("FLOCK_OVER_CAPACITY"));
        transfer.put("quantity", 200);
        post("/api/flocks/" + flockId + "/transfer", transfer).andExpect(status().isCreated())
            .andExpect(jsonPath("$.data.sourceType").value("TRANSFER"))
            .andExpect(jsonPath("$.data.gender").value("FEMALE"))
            .andExpect(jsonPath("$.data.ageAtImport").value(11))
            .andExpect(jsonPath("$.data.sourceNote").value(org.hamcrest.Matchers.containsString("Nhà A3")));

        JsonNode source = detail(cycle);
        org.junit.jupiter.api.Assertions.assertEquals(800, source.path("metrics").path("currentQuantity").asInt());
        org.junit.jupiter.api.Assertions.assertEquals(200, source.path("metrics").path("transferredOut").asInt());
        org.junit.jupiter.api.Assertions.assertEquals(8800000, source.path("finance").path("chickCost").asLong());
        JsonNode moved = detail(targetCycle);
        org.junit.jupiter.api.Assertions.assertEquals(200, moved.path("metrics").path("currentQuantity").asInt());
        org.junit.jupiter.api.Assertions.assertEquals(2200000, moved.path("finance").path("chickCost").asLong());
        // Transfers are not purchases, so they do not open a 3-day import window on the target cycle.
        org.junit.jupiter.api.Assertions.assertTrue(moved.path("metrics").path("firstImportDate").isNull());
        mvc.perform(get("/api/barns/" + target)).andExpect(jsonPath("$.data.currentQuantity").value(200));
    }

    @Test
    void recordsLossesAndHarvestThenClosesCycleAndStartsTheNextOne() throws Exception {
        long cycle = startCycle(barnId, START);
        long flockId = importFlock(cycle, "Gà Mía", "MIXED", START, 100);
        post("/api/flocks/" + flockId + "/losses", Map.of("type", "DEATH", "movementDate", TODAY.toString(), "quantity", 3))
            .andExpect(status().isCreated());
        post("/api/flocks/" + flockId + "/losses", Map.of("type", "CULL", "movementDate", TODAY.toString(), "quantity", 2, "weightKg", 2))
            .andExpect(status().isCreated());
        post("/api/flocks/" + flockId + "/losses", Map.of("type", "HARVEST", "movementDate", TODAY.toString(), "quantity", 1))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errorCode").value("FLOCK_LOSS_TYPE"));
        post("/api/flocks/" + flockId + "/harvests", Map.of("movementDate", TODAY.toString(), "quantity", 96, "weightKg", 200, "unitPrice", 60000))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errorCode").value("FLOCK_INSUFFICIENT"));

        post("/api/cycles/" + cycle + "/close", Map.of("endDate", TODAY.toString()))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.errorCode").value("CYCLE_HAS_ANIMALS"));
        post("/api/flocks/" + flockId + "/harvests", Map.of("movementDate", TODAY.toString(), "quantity", 95, "weightKg", 200, "unitPrice", 60000))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.data.amount").value(12000000));

        mvc.perform(get("/api/cycles/" + cycle))
            .andExpect(jsonPath("$.data.metrics.deaths").value(3))
            .andExpect(jsonPath("$.data.metrics.lossRate").value(closeTo(3.0, 0.001)))
            .andExpect(jsonPath("$.data.metrics.culls").value(2))
            .andExpect(jsonPath("$.data.metrics.harvestedQuantity").value(95))
            .andExpect(jsonPath("$.data.finance.revenue").value(12000000))
            .andExpect(jsonPath("$.data.flocks[0].status").value("ARCHIVED"));

        post("/api/cycles/" + cycle + "/close", Map.of("endDate", START.minusDays(1).toString()))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errorCode").value("CYCLE_END_DATE"));
        post("/api/cycles/" + cycle + "/close", Map.of("endDate", TODAY.toString())).andExpect(status().isOk())
            .andExpect(jsonPath("$.data.status").value("CLOSED"));
        mvc.perform(get("/api/barns/" + barnId)).andExpect(jsonPath("$.data.status").value("INACTIVE"))
            .andExpect(jsonPath("$.data.activeCycleId").doesNotExist());
        post("/api/cycles/" + cycle + "/feed-records", Map.of("recordDate", TODAY.toString(), "feedName", "Higro", "quantityKg", 1, "unitPrice", 1))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.errorCode").value("CYCLE_CLOSED"));

        post("/api/barns/" + barnId + "/cycles", Map.of("startDate", TODAY.toString())).andExpect(status().isCreated())
            .andExpect(jsonPath("$.data.cycleNumber").value(2));
        mvc.perform(get("/api/barns/" + barnId + "/cycles")).andExpect(jsonPath("$.data.length()").value(2))
            .andExpect(jsonPath("$.data[1].status").value("CLOSED"));
    }

    @Test
    void rejectsCyclesWithFutureOrInvalidDates() throws Exception {
        mvc.perform(get("/api/barns/" + barnId)).andExpect(jsonPath("$.data.status").value("INACTIVE"));
        post("/api/barns/" + barnId + "/cycles", Map.of("startDate", TODAY.plusDays(1).toString()))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errorCode").value("CYCLE_FUTURE_DATE"));
        post("/api/barns/" + barnId + "/cycles", Map.of("startDate", START.toString(), "hatchDate", START.plusDays(1).toString()))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errorCode").value("CYCLE_HATCH_AFTER_START"));
    }

    @Test
    void flockFollowsItsBreedProgramWithTodaysPlan() throws Exception {
        long cycle = startCycle(barnId, START);
        Map<String, Object> noProgram = flock("Gà Mía", "MIXED", START, 100);
        noProgram.remove("programId");
        post("/api/cycles/" + cycle + "/flocks", noProgram).andExpect(status().isBadRequest());
        Map<String, Object> unknownProgram = flock("Gà Mía", "MIXED", START, 100);
        unknownProgram.put("programId", 99999);
        post("/api/cycles/" + cycle + "/flocks", unknownProgram).andExpect(status().isNotFound());

        importFlock(cycle, "Gà Mía", "MIXED", START, 1000);
        // The flock is 11 days old today: Lasota 1 is done, Gumboro and the medicine run today, Lasota 2 is upcoming.
        mvc.perform(get("/api/cycles/" + cycle))
            .andExpect(jsonPath("$.data.flocks[0].programName").value("Gà Mía thương phẩm"))
            .andExpect(jsonPath("$.data.programs[0].currentDay").value(11))
            .andExpect(jsonPath("$.data.programs[0].activeFlockCount").value(1))
            .andExpect(jsonPath("$.data.programs[0].steps[?(@.name == 'Lasota lần 1')].state").value("DONE"))
            .andExpect(jsonPath("$.data.programs[0].steps[?(@.name == 'Gumboro')].state").value("IN_PROGRESS"))
            .andExpect(jsonPath("$.data.programs[0].steps[?(@.name == 'Lasota lần 2')].state").value("UPCOMING"));
        // Today's work sheet: 20 g x 1000 birds = 20 kg a day over 5 meals = 4 kg a meal; medicine 2 g per kg of that feed = 40 g.
        mvc.perform(get("/api/cycles/" + cycle + "/daily-plan"))
            .andExpect(jsonPath("$.data.headcount").value(1000))
            .andExpect(jsonPath("$.data.flocks[0].ageDays").value(11))
            .andExpect(jsonPath("$.data.tasks[?(@.category == 'FEED')].meal").value(org.hamcrest.Matchers.contains(1, 2, 3, 4, 5)))
            .andExpect(jsonPath("$.data.tasks[?(@.category == 'FEED')].plannedQuantity").value(org.hamcrest.Matchers.everyItem(org.hamcrest.Matchers.is(4.0))))
            .andExpect(jsonPath("$.data.tasks[?(@.category == 'VACCINE')].name").value("Gumboro"))
            .andExpect(jsonPath("$.data.tasks[?(@.category == 'MEDICINE')].plannedQuantity").value(40.0))
            .andExpect(jsonPath("$.data.tasks[?(@.category == 'MEDICINE')].unit").value("g"))
            .andExpect(jsonPath("$.data.tasks[?(@.category == 'TEMPERATURE')].name").value("Úm"));

        mvc.perform(delete("/api/farming-programs/" + programId)).andExpect(status().isConflict())
            .andExpect(jsonPath("$.errorCode").value("PROGRAM_IN_USE"));
    }

    @Test
    void showsAFreshlyDeclaredCycleBeforeAnyFlockArrives() throws Exception {
        long cycle = startCycle(barnId, TODAY);
        mvc.perform(get("/api/cycles/" + cycle))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.flocks.length()").value(0))
            .andExpect(jsonPath("$.data.metrics.currentQuantity").value(0))
            .andExpect(jsonPath("$.data.finance.totalCost").value(0));
    }

    @Test
    void ownerAssignsOrChangesTheProgramOfARunningFlock() throws Exception {
        long cycle = startCycle(barnId, START);
        long flockId = importFlock(cycle, "Gà Mía", "MIXED", START, 100);
        long shortProgram = id(post("/api/farming-programs", Map.of("name", "Úm 7 ngày", "breed", "Gà Mía", "durationDays", 7,
                "steps", List.of(Map.of("category", "FEED", "name", "Higro 01", "dayFrom", 1, "dayTo", 7, "quantity", 20, "mealsPerDay", 5)))));
        long longProgram = id(post("/api/farming-programs", Map.of("name", "Gà ta thả vườn", "breed", "Gà ta", "durationDays", 105,
                "steps", List.of(Map.of("category", "FEED", "name", "Gà ta", "dayFrom", 1, "dayTo", 105, "quantity", 60, "mealsPerDay", 3)))));
        String url = "/api/flocks/" + flockId + "/program";

        // The flock is 11 days old, so a 7-day program no longer fits.
        mvc.perform(put(url).contentType(MediaType.APPLICATION_JSON).content("{\"programId\":" + shortProgram + "}"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errorCode").value("FLOCK_PROGRAM_TOO_SHORT"));
        mvc.perform(put(url).contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isBadRequest());
        mvc.perform(put(url).contentType(MediaType.APPLICATION_JSON).content("{\"programId\":" + longProgram + "}")
                .with(user("worker@farm.test").authorities(() -> "ROLE_FARM_WORKER"))).andExpect(status().isForbidden());

        mvc.perform(put(url).contentType(MediaType.APPLICATION_JSON).content("{\"programId\":" + longProgram + "}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.programName").value("Gà ta thả vườn"));
        mvc.perform(get("/api/cycles/" + cycle))
            .andExpect(jsonPath("$.data.programs[0].name").value("Gà ta thả vườn"))
            .andExpect(jsonPath("$.data.programs[0].currentDay").value(11));

        // Whole cycle at once: every running flock gets the program, or none does when one is too old.
        importFlock(cycle, "Gà Mía mái", "FEMALE", START.plusDays(1), 100);
        String all = "/api/cycles/" + cycle + "/program";
        mvc.perform(put(all).contentType(MediaType.APPLICATION_JSON).content("{\"programId\":" + shortProgram + "}"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errorCode").value("FLOCK_PROGRAM_TOO_SHORT"));
        mvc.perform(put(all).contentType(MediaType.APPLICATION_JSON).content("{\"programId\":" + programId + "}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.length()").value(2))
            .andExpect(jsonPath("$.data[*].programName").value(org.hamcrest.Matchers.everyItem(org.hamcrest.Matchers.is("Gà Mía thương phẩm"))));
        mvc.perform(get("/api/cycles/" + cycle))
            .andExpect(jsonPath("$.data.programs.length()").value(1))
            .andExpect(jsonPath("$.data.programs[0].activeFlockCount").value(2));
    }

    @Test
    void appliesRolePermissionsAndHidesFinanceFromWorkers() throws Exception {
        long cycle = startCycle(barnId, START);
        long flockId = importFlock(cycle, "Gà Mía", "MIXED", START, 100);
        var worker = user("worker@farm.test").authorities(() -> "ROLE_FARM_WORKER");
        var accountant = user("ketoan@farm.test").authorities(() -> "ROLE_ACCOUNTANT");
        String feed = mapper.writeValueAsString(Map.of("recordDate", TODAY.toString(), "feedName", "Higro", "quantityKg", 10, "unitPrice", 13000));
        String loss = mapper.writeValueAsString(Map.of("type", "DEATH", "movementDate", TODAY.toString(), "quantity", 1));
        String harvest = mapper.writeValueAsString(Map.of("movementDate", TODAY.toString(), "quantity", 1, "weightKg", 2, "unitPrice", 60000));
        String expense = mapper.writeValueAsString(Map.of("expenseDate", TODAY.toString(), "category", "WATER", "amount", 100000));
        String flock = mapper.writeValueAsString(flock("Gà J", "MIXED", START, 10));
        String weight = mapper.writeValueAsString(Map.of("sampleDate", TODAY.toString(), "avgWeightKg", 0.45, "sampleSize", 30));

        // Công nhân chưa được phân công chuồng này thì không ghi được nhật ký.
        long workerId = workerAccount("worker@farm.test");
        for (String[] write : new String[][] {{"/api/cycles/" + cycle + "/feed-records", feed}, {"/api/cycles/" + cycle + "/weight-samples", weight},
                {"/api/flocks/" + flockId + "/losses", loss}}) {
            mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post(write[0]).with(worker)
                .contentType(MediaType.APPLICATION_JSON).content(write[1]))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.errorCode").value("BARN_NOT_ASSIGNED"));
        }
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/api/barns/" + barnId + "/workers")
            .contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(Map.of("workerIds", List.of(workerId))))).andExpect(status().isOk());

        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/cycles/" + cycle + "/feed-records").with(worker)
            .contentType(MediaType.APPLICATION_JSON).content(feed)).andExpect(status().isCreated());
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/cycles/" + cycle + "/weight-samples").with(worker)
            .contentType(MediaType.APPLICATION_JSON).content(weight)).andExpect(status().isCreated());
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/flocks/" + flockId + "/losses").with(worker)
            .contentType(MediaType.APPLICATION_JSON).content(loss)).andExpect(status().isCreated());
        mvc.perform(get("/api/cycles/" + cycle).with(worker))
            .andExpect(jsonPath("$.data.metrics.currentQuantity").value(99))
            .andExpect(jsonPath("$.data.metrics.avgWeightKg").value(0.45));
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/flocks/" + flockId + "/harvests").with(worker)
            .contentType(MediaType.APPLICATION_JSON).content(harvest)).andExpect(status().isForbidden());
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/cycles/" + cycle + "/flocks").with(worker)
            .contentType(MediaType.APPLICATION_JSON).content(flock)).andExpect(status().isForbidden());
        mvc.perform(get("/api/cycles/" + cycle).with(worker)).andExpect(status().isOk())
            .andExpect(jsonPath("$.data.finance").doesNotExist())
            .andExpect(jsonPath("$.data.expenses").doesNotExist())
            .andExpect(jsonPath("$.data.flocks[0].unitPrice").doesNotExist());

        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/flocks/" + flockId + "/harvests").with(accountant)
            .contentType(MediaType.APPLICATION_JSON).content(harvest)).andExpect(status().isCreated());
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/cycles/" + cycle + "/expenses").with(accountant)
            .contentType(MediaType.APPLICATION_JSON).content(expense)).andExpect(status().isCreated());
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/cycles/" + cycle + "/feed-records").with(accountant)
            .contentType(MediaType.APPLICATION_JSON).content(feed)).andExpect(status().isForbidden());
        mvc.perform(get("/api/cycles/" + cycle).with(accountant)).andExpect(jsonPath("$.data.finance.expenses.WATER").value(100000));
    }
}
