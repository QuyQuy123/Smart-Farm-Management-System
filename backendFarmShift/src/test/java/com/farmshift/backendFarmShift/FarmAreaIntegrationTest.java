package com.farmshift.backendFarmShift;

import com.farmshift.backendFarmShift.repository.BarnRepository;
import com.farmshift.backendFarmShift.repository.FarmAreaRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithAnonymousUser;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@WithMockUser(authorities = "ROLE_FARM_OWNER")
class FarmAreaIntegrationTest {
    private static final String AREAS = "/api/farm-areas";
    private static final String BARNS = "/api/barns";
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired FarmAreaRepository areaRepository;
    @Autowired BarnRepository barnRepository;

    @BeforeEach
    void reset() {
        barnRepository.deleteAll();
        areaRepository.deleteAll();
    }

    private Map<String, Object> area(String name) {
        Map<String, Object> body = new HashMap<>();
        body.put("name", name);
        body.put("livestockType", "POULTRY");
        body.put("mealsPerDay", 3);
        body.put("environmentMetrics", List.of("TEMPERATURE", "HUMIDITY", "TEMPERATURE"));
        body.put("animalMetrics", List.of("LOSS", "WEIGHT"));
        body.put("description", " Gà thịt ");
        return body;
    }

    private Map<String, Object> barn(long areaId, String name, int capacity, int current) {
        Map<String, Object> body = new HashMap<>();
        body.put("areaId", areaId);
        body.put("name", name);
        body.put("purpose", "FARMING");
        body.put("status", current > 0 ? "ACTIVE" : "INACTIVE");
        body.put("capacity", capacity);
        body.put("currentQuantity", current);
        body.put("targetWeight", 2.3);
        return body;
    }

    private long create(String url, Object body) throws Exception {
        var result = mvc.perform(post(url).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(body)))
            .andExpect(status().isCreated()).andReturn();
        return mapper.readTree(result.getResponse().getContentAsString()).path("data").path("id").asLong();
    }

    @Test
    void createsAreaWithBarnsAndReportsLiveSummary() throws Exception {
        mvc.perform(post(AREAS).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(area("  Khu   Mía Thịt "))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.data.name").value("Khu Mía Thịt"))
            .andExpect(jsonPath("$.data.code").value(org.hamcrest.Matchers.startsWith("KN")))
            .andExpect(jsonPath("$.data.environmentMetrics.length()").value(2))
            .andExpect(jsonPath("$.data.environmentMetrics[0]").value("HUMIDITY"))
            .andExpect(jsonPath("$.data.animalMetrics[0]").value("WEIGHT"))
            .andExpect(jsonPath("$.data.description").value("Gà thịt"))
            .andExpect(jsonPath("$.data.barnCount").value(0));
        long areaId = areaRepository.findAll().get(0).getId();

        create(BARNS, barn(areaId, "Nhà A1", 50000, 50000));
        create(BARNS, barn(areaId, "Nhà A2", 50000, 40000));
        create(BARNS, barn(areaId, "Nhà A3", 50000, 0));

        mvc.perform(get(AREAS + "/" + areaId)).andExpect(status().isOk())
            .andExpect(jsonPath("$.data.barnCount").value(3))
            .andExpect(jsonPath("$.data.activeBarnCount").value(2))
            .andExpect(jsonPath("$.data.animalCount").value(90000))
            .andExpect(jsonPath("$.data.totalCapacity").value(150000));
        mvc.perform(get(BARNS).param("areaId", String.valueOf(areaId))).andExpect(status().isOk())
            .andExpect(jsonPath("$.data.length()").value(3))
            .andExpect(jsonPath("$.data[0].name").value("Nhà A1"))
            .andExpect(jsonPath("$.data[0].areaName").value("Khu Mía Thịt"))
            .andExpect(jsonPath("$.data[0].code").value(org.hamcrest.Matchers.startsWith("CH")));
        mvc.perform(get(AREAS)).andExpect(status().isOk()).andExpect(jsonPath("$.data[0].barnCount").value(3));
    }

    @Test
    void updatesAreaAndMovesBarnBetweenAreas() throws Exception {
        long mia = create(AREAS, area("Khu Mía Thịt"));
        long j = create(AREAS, area("Khu J Thịt"));
        long barnId = create(BARNS, barn(mia, "Nhà A1", 100, 10));

        Map<String, Object> rename = area("Khu Mía Thịt 2");
        rename.put("livestockType", "LIVESTOCK");
        rename.put("mealsPerDay", 0);
        mvc.perform(put(AREAS + "/" + mia).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(rename)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.livestockType").value("LIVESTOCK"))
            .andExpect(jsonPath("$.data.mealsPerDay").value(0));

        mvc.perform(put(BARNS + "/" + barnId).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(barn(j, "Nhà B1", 100, 20))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.areaId").value(j))
            .andExpect(jsonPath("$.data.name").value("Nhà B1")).andExpect(jsonPath("$.data.currentQuantity").value(20));
        mvc.perform(get(AREAS + "/" + mia)).andExpect(jsonPath("$.data.barnCount").value(0));
        mvc.perform(get(AREAS + "/" + j)).andExpect(jsonPath("$.data.animalCount").value(20));
    }

    @Test
    void enforcesUniqueNames() throws Exception {
        long mia = create(AREAS, area("Khu Mía Thịt"));
        long j = create(AREAS, area("Khu J Thịt"));
        mvc.perform(post(AREAS).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(area(" KHU MÍA THỊT "))))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.errorCode").value("FARM_AREA_DUPLICATE"));
        mvc.perform(put(AREAS + "/" + mia).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(area("Khu Mía Thịt"))))
            .andExpect(status().isOk());

        create(BARNS, barn(mia, "Nhà A1", 100, 0));
        mvc.perform(post(BARNS).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(barn(mia, "nhà a1", 100, 0))))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.errorCode").value("BARN_DUPLICATE"));
        // The same barn name is allowed in a different area.
        create(BARNS, barn(j, "Nhà A1", 100, 0));
    }

    @Test
    void rejectsInvalidAreaInput() throws Exception {
        Map<String, Object> blank = area(" ");
        mvc.perform(post(AREAS).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(blank)))
            .andExpect(status().isBadRequest());
        Map<String, Object> meals = area("Khu A");
        meals.put("mealsPerDay", 7);
        mvc.perform(post(AREAS).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(meals)))
            .andExpect(status().isBadRequest());
        Map<String, Object> metric = area("Khu A");
        metric.put("environmentMetrics", List.of("CO2"));
        mvc.perform(post(AREAS).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(metric)))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errorCode").value("FARM_AREA_INVALID_METRIC"));
        Map<String, Object> type = area("Khu A");
        type.put("livestockType", "DINOSAUR");
        mvc.perform(post(AREAS).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(type)))
            .andExpect(status().isBadRequest());
        assertEquals(0, areaRepository.count());
    }

    @Test
    void enforcesBarnQuantityRules() throws Exception {
        long areaId = create(AREAS, area("Khu A"));
        mvc.perform(post(BARNS).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(barn(areaId, "Nhà 1", 100, 101))))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errorCode").value("BARN_OVER_CAPACITY"));
        Map<String, Object> treatment = barn(areaId, "Bể xử lý", 100, 5);
        treatment.put("purpose", "BIO_TREATMENT");
        mvc.perform(post(BARNS).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(treatment)))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errorCode").value("BARN_TREATMENT_NOT_EMPTY"));
        Map<String, Object> closed = barn(areaId, "Nhà 2", 100, 5);
        closed.put("status", "CLOSED");
        mvc.perform(post(BARNS).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(closed)))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errorCode").value("BARN_INACTIVE_NOT_EMPTY"));
        Map<String, Object> zeroCapacity = barn(areaId, "Nhà 3", 0, 0);
        mvc.perform(post(BARNS).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(zeroCapacity)))
            .andExpect(status().isBadRequest());
        mvc.perform(post(BARNS).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(barn(99999, "Nhà 4", 10, 0))))
            .andExpect(status().isNotFound());
        assertEquals(0, barnRepository.count());
    }

    @Test
    void blocksDeletingAreaWithBarnsAndBarnWithAnimals() throws Exception {
        long areaId = create(AREAS, area("Khu A"));
        long barnId = create(BARNS, barn(areaId, "Nhà 1", 100, 30));

        mvc.perform(delete(AREAS + "/" + areaId)).andExpect(status().isConflict())
            .andExpect(jsonPath("$.errorCode").value("FARM_AREA_HAS_BARNS"));
        mvc.perform(delete(BARNS + "/" + barnId)).andExpect(status().isConflict())
            .andExpect(jsonPath("$.errorCode").value("BARN_NOT_EMPTY"));

        mvc.perform(put(BARNS + "/" + barnId).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(barn(areaId, "Nhà 1", 100, 0))))
            .andExpect(status().isOk());
        mvc.perform(delete(BARNS + "/" + barnId)).andExpect(status().isOk());
        mvc.perform(delete(AREAS + "/" + areaId)).andExpect(status().isOk());
        mvc.perform(get(AREAS + "/" + areaId)).andExpect(status().isNotFound());
        mvc.perform(get(BARNS).param("areaId", String.valueOf(areaId))).andExpect(status().isNotFound());
    }

    @Test
    @WithMockUser(authorities = "ROLE_FARM_WORKER")
    void nonOwnerCanReadButCannotWrite() throws Exception {
        mvc.perform(get(AREAS)).andExpect(status().isOk());
        mvc.perform(get(BARNS)).andExpect(status().isOk());
        mvc.perform(post(AREAS).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(area("Khu A"))))
            .andExpect(status().isForbidden());
        mvc.perform(put(AREAS + "/1").contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(area("Khu A"))))
            .andExpect(status().isForbidden());
        mvc.perform(delete(AREAS + "/1")).andExpect(status().isForbidden());
        mvc.perform(post(BARNS).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(barn(1, "Nhà 1", 10, 0))))
            .andExpect(status().isForbidden());
        mvc.perform(delete(BARNS + "/1")).andExpect(status().isForbidden());
    }

    @Test
    @WithAnonymousUser
    void requiresAuthentication() throws Exception {
        mvc.perform(get(AREAS)).andExpect(status().is4xxClientError());
        mvc.perform(get(BARNS)).andExpect(status().is4xxClientError());
    }
}
