package com.farmshift.backendFarmShift;

import com.fasterxml.jackson.databind.ObjectMapper;
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

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@WithMockUser(authorities = "ROLE_FARM_OWNER")
class FarmingProgramIntegrationTest {
    private static final String API = "/api/farming-programs";
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;

    private ResultActions send(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request, Object body) throws Exception {
        return mvc.perform(request.contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(body)));
    }

    private static Map<String, Object> step(String category, String name, int from, int to, Object... extra) {
        Map<String, Object> step = new HashMap<>(Map.of("category", category, "name", name, "dayFrom", from, "dayTo", to));
        for (int i = 0; i < extra.length; i += 2) step.put((String) extra[i], extra[i + 1]);
        return step;
    }

    /** Gà ta thả vườn: 105 ngày, 1,5–2,2 kg. */
    private static Map<String, Object> gaTa(List<Map<String, Object>> steps) {
        Map<String, Object> body = new HashMap<>(Map.of("name", "Gà ta thả vườn", "breed", "Gà ta", "durationDays", 105,
                "targetWeightMin", 1.5, "targetWeightMax", 2.2, "description", "Nuôi thả vườn 5 tháng"));
        body.put("steps", steps);
        return body;
    }

    private static List<Map<String, Object>> fullPlan() {
        return new ArrayList<>(List.of(
                step("FEED", "Cám gà con", 1, 21, "quantity", 15, "mealsPerDay", 6),
                step("FEED", "Cám gà lớn", 22, 105, "quantity", 70, "mealsPerDay", 3),
                step("VACCINE", "Marek", 1, 1, "method", "INJECTION", "quantity", 1, "unit", "liều/con"),
                step("VACCINE", "Đậu gà", 8, 8, "method", "WING_WEB"),
                step("MEDICINE", "Vitamin C + điện giải", 1, 7, "method", "MIX_WATER", "quantity", 2, "unit", "g/lít nước"),
                step("TEMPERATURE", "Úm tuần 1", 1, 7, "tempMin", 31, "tempMax", 33),
                step("TEMPERATURE", "Úm tuần 2", 8, 14, "tempMin", 28, "tempMax", 30)));
    }

    @Test
    void rejectsWorkStepsBecauseCareWorkIsAssignedSeparately() throws Exception {
        List<Map<String, Object>> steps = fullPlan();
        steps.add(step("WORK", "Vệ sinh máng ăn máng uống", 1, 105));
        send(post(API), gaTa(steps)).andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errorCode").value("PROGRAM_WORK_NOT_ALLOWED"));
    }

    @Test
    void createsBreedProgramWithAllSections() throws Exception {
        send(post(API), gaTa(fullPlan())).andExpect(status().isCreated())
            .andExpect(jsonPath("$.data.breed").value("Gà ta"))
            .andExpect(jsonPath("$.data.durationDays").value(105))
            .andExpect(jsonPath("$.data.targetWeightMax").value(2.2))
            .andExpect(jsonPath("$.data.steps.length()").value(7))
            .andExpect(jsonPath("$.data.steps[?(@.name == 'Cám gà con')].mealsPerDay").value(6))
            .andExpect(jsonPath("$.data.steps[?(@.name == 'Cám gà con')].unit").value("g/con/ngày"))
            .andExpect(jsonPath("$.data.steps[?(@.name == 'Đậu gà')].method").value("WING_WEB"))
            // Fields that do not belong to a category are dropped (no feed meals on a vaccine).
            .andExpect(jsonPath("$.data.steps[?(@.name == 'Marek')].mealsPerDay").value(org.hamcrest.Matchers.contains(org.hamcrest.Matchers.nullValue())))
            .andExpect(jsonPath("$.data.code").value(org.hamcrest.Matchers.startsWith("CT")));
        send(post(API), gaTa(fullPlan())).andExpect(status().isConflict()).andExpect(jsonPath("$.errorCode").value("PROGRAM_DUPLICATE"));
        mvc.perform(get(API)).andExpect(status().isOk()).andExpect(jsonPath("$.data[0].activeFlockCount").value(0));
    }

    @Test
    void rejectsInvalidSchedules() throws Exception {
        expectError(gaTa(List.of(step("VACCINE", "Marek", 1, 1, "method", "INJECTION"))), "PROGRAM_FEED_REQUIRED");
        expectError(gaTa(List.of(step("FEED", "Cám", 1, 21, "mealsPerDay", 4))), "PROGRAM_FEED_INCOMPLETE");
        expectError(gaTa(List.of(step("FEED", "Cám", 1, 30, "quantity", 15, "mealsPerDay", 4),
                step("FEED", "Cám 2", 30, 105, "quantity", 60, "mealsPerDay", 3))), "PROGRAM_FEED_OVERLAP");
        expectError(gaTa(List.of(step("FEED", "Cám", 1, 120, "quantity", 15, "mealsPerDay", 4))), "PROGRAM_STEP_OUT_OF_DURATION");
        expectError(gaTa(List.of(step("FEED", "Cám", 10, 5, "quantity", 15, "mealsPerDay", 4))), "PROGRAM_STEP_RANGE");

        List<Map<String, Object>> vaccineWithoutMethod = fullPlan();
        vaccineWithoutMethod.add(step("VACCINE", "Gumboro", 7, 7));
        expectError(gaTa(vaccineWithoutMethod), "PROGRAM_METHOD_REQUIRED");
        List<Map<String, Object>> vaccineMixedInFeed = fullPlan();
        vaccineMixedInFeed.add(step("VACCINE", "Gumboro", 7, 7, "method", "MIX_FEED"));
        expectError(gaTa(vaccineMixedInFeed), "PROGRAM_METHOD_REQUIRED");
        List<Map<String, Object>> medicineWithoutDose = fullPlan();
        medicineWithoutDose.add(step("MEDICINE", "Thuốc cầu trùng", 15, 17, "method", "MIX_WATER"));
        expectError(gaTa(medicineWithoutDose), "PROGRAM_MEDICINE_DOSE");
        List<Map<String, Object>> badTemperature = fullPlan();
        badTemperature.add(step("TEMPERATURE", "Sai", 15, 20, "tempMin", 30, "tempMax", 28));
        expectError(gaTa(badTemperature), "PROGRAM_TEMPERATURE_RANGE");
        List<Map<String, Object>> overlappingTemperature = fullPlan();
        overlappingTemperature.add(step("TEMPERATURE", "Chồng", 14, 20, "tempMin", 26, "tempMax", 28));
        expectError(gaTa(overlappingTemperature), "PROGRAM_TEMPERATURE_OVERLAP");

        Map<String, Object> weights = gaTa(fullPlan());
        weights.put("targetWeightMin", 2.5);
        expectError(weights, "PROGRAM_WEIGHT_RANGE");
        Map<String, Object> noBreed = gaTa(fullPlan());
        noBreed.put("breed", " ");
        send(post(API), noBreed).andExpect(status().isBadRequest());
    }

    @Test
    void updatesReplacesStepsAndDeletesUnusedProgram() throws Exception {
        var created = send(post(API), gaTa(fullPlan())).andExpect(status().isCreated()).andReturn();
        long id = mapper.readTree(created.getResponse().getContentAsString()).path("data").path("id").asLong();
        Map<String, Object> shorter = gaTa(List.of(step("FEED", "Cám gà ta", 1, 90, "quantity", 50, "mealsPerDay", 3)));
        shorter.put("durationDays", 90);
        send(put(API + "/" + id), shorter).andExpect(status().isOk())
            .andExpect(jsonPath("$.data.durationDays").value(90)).andExpect(jsonPath("$.data.steps.length()").value(1));
        mvc.perform(delete(API + "/" + id)).andExpect(status().isOk());
        mvc.perform(get(API + "/" + id)).andExpect(status().isNotFound());
    }

    @Test
    @WithMockUser(authorities = "ROLE_FARM_WORKER")
    void workersCanReadProgramsButNotEditThem() throws Exception {
        mvc.perform(get(API)).andExpect(status().isOk());
        send(post(API), gaTa(fullPlan())).andExpect(status().isForbidden());
        mvc.perform(delete(API + "/1")).andExpect(status().isForbidden());
    }

    private void expectError(Map<String, Object> body, String code) throws Exception {
        send(post(API), body).andExpect(status().isBadRequest()).andExpect(jsonPath("$.errorCode").value(code));
    }
}
