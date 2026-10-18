package com.farmshift.backendFarmShift;

import com.farmshift.backendFarmShift.repository.*;
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

import java.time.LocalDate;
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
        areaRepository.deleteAll();
    }

    private Map<String, Object> area(String name) {
        Map<String, Object> body = new HashMap<>();
        body.put("name", name);
        body.put("environmentMetrics", List.of("TEMPERATURE", "HUMIDITY", "TEMPERATURE"));
        body.put("animalMetrics", List.of("LOSS", "WEIGHT"));
        body.put("description", " Gà thịt ");
        return body;
    }

    private Map<String, Object> barn(long areaId, String name, int capacity) {
        Map<String, Object> body = new HashMap<>();
        body.put("areaId", areaId);
        body.put("name", name);
        body.put("capacity", capacity);
        body.put("areaM2", 1000);
        body.put("targetWeight", 2.3);
        return body;
    }

    private long create(String url, Object body) throws Exception {
        var result = mvc.perform(post(url).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(body)))
            .andExpect(status().isCreated()).andReturn();
        return mapper.readTree(result.getResponse().getContentAsString()).path("data").path("id").asLong();
    }

    /** Animals only enter a barn through a farming cycle: declare the cycle, then import a flock. */
    private long stock(long barnId, int quantity) throws Exception {
        String today = LocalDate.now().toString();
        long cycleId = create(BARNS + "/" + barnId + "/cycles", Map.of("startDate", today));
        create("/api/cycles/" + cycleId + "/flocks", Map.of("name", "Gà Mía", "gender", "MIXED", "importDate", today,
                "ageAtImport", 1, "quantity", quantity, "avgWeight", 0.04, "unitPrice", 12000));
        return cycleId;
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

        stock(create(BARNS, barn(areaId, "Nhà A1", 50000)), 50000);
        stock(create(BARNS, barn(areaId, "Nhà A2", 50000)), 40000);
        create(BARNS, barn(areaId, "Nhà A3", 50000));

        mvc.perform(get(AREAS + "/" + areaId)).andExpect(status().isOk())
            .andExpect(jsonPath("$.data.barnCount").value(3))
            .andExpect(jsonPath("$.data.activeBarnCount").value(2))
            .andExpect(jsonPath("$.data.animalCount").value(90000))
            .andExpect(jsonPath("$.data.totalCapacity").value(150000));
        mvc.perform(get(BARNS).param("areaId", String.valueOf(areaId))).andExpect(status().isOk())
            .andExpect(jsonPath("$.data.length()").value(3))
            .andExpect(jsonPath("$.data[0].name").value("Nhà A1"))
            .andExpect(jsonPath("$.data[0].areaName").value("Khu Mía Thịt"))
            .andExpect(jsonPath("$.data[0].status").value("ACTIVE"))
            .andExpect(jsonPath("$.data[0].activeCycleId").isNumber())
            .andExpect(jsonPath("$.data[2].activeCycleId").doesNotExist())
            .andExpect(jsonPath("$.data[0].code").value(org.hamcrest.Matchers.startsWith("CH")));
        mvc.perform(get(AREAS)).andExpect(status().isOk()).andExpect(jsonPath("$.data[0].barnCount").value(3));
    }

    @Test
    void updatesAreaAndMovesOnlyBarnsWithoutRunningCycle() throws Exception {
        long mia = create(AREAS, area("Khu Mía Thịt"));
        long j = create(AREAS, area("Khu J Thịt"));
        long empty = create(BARNS, barn(mia, "Nhà A1", 100));
        long stocked = create(BARNS, barn(mia, "Nhà A2", 100));
        stock(stocked, 20);

        mvc.perform(put(AREAS + "/" + mia).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(area("Khu Mía Thịt 2"))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.name").value("Khu Mía Thịt 2"))
            .andExpect(jsonPath("$.data.livestockType").doesNotExist())
            .andExpect(jsonPath("$.data.mealsPerDay").doesNotExist());

        mvc.perform(put(BARNS + "/" + empty).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(barn(j, "Nhà B1", 100))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.areaId").value(j)).andExpect(jsonPath("$.data.name").value("Nhà B1"));
        mvc.perform(put(BARNS + "/" + stocked).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(barn(j, "Nhà A2", 100))))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errorCode").value("BARN_ACTIVE_CYCLE_MOVE"));
    }

    @Test
    void enforcesUniqueNames() throws Exception {
        long mia = create(AREAS, area("Khu Mía Thịt"));
        long j = create(AREAS, area("Khu J Thịt"));
        mvc.perform(post(AREAS).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(area(" KHU MÍA THỊT "))))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.errorCode").value("FARM_AREA_DUPLICATE"));
        mvc.perform(put(AREAS + "/" + mia).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(area("Khu Mía Thịt"))))
            .andExpect(status().isOk());

        create(BARNS, barn(mia, "Nhà A1", 100));
        mvc.perform(post(BARNS).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(barn(mia, "nhà a1", 100))))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.errorCode").value("BARN_DUPLICATE"));
        // The same barn name is allowed in a different area.
        create(BARNS, barn(j, "Nhà A1", 100));
    }

    @Test
    void rejectsInvalidAreaInput() throws Exception {
        Map<String, Object> blank = area(" ");
        mvc.perform(post(AREAS).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(blank)))
            .andExpect(status().isBadRequest());
        Map<String, Object> metric = area("Khu A");
        metric.put("environmentMetrics", List.of("CO2"));
        mvc.perform(post(AREAS).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(metric)))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errorCode").value("FARM_AREA_INVALID_METRIC"));
        assertEquals(0, areaRepository.count());
    }

    @Test
    void enforcesBarnRulesAgainstItsStockAndCycle() throws Exception {
        long areaId = create(AREAS, area("Khu A"));
        mvc.perform(post(BARNS).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(barn(areaId, "Nhà 0", 0))))
            .andExpect(status().isBadRequest());
        mvc.perform(post(BARNS).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(barn(99999, "Nhà 4", 10))))
            .andExpect(status().isNotFound());

        long barnId = create(BARNS, barn(areaId, "Nhà 1", 100));
        stock(barnId, 80);
        mvc.perform(put(BARNS + "/" + barnId).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(barn(areaId, "Nhà 1", 50))))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errorCode").value("BARN_CAPACITY_BELOW_STOCK"));
        // Editing a barn never changes its status: it stays active while the cycle runs.
        mvc.perform(put(BARNS + "/" + barnId).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(barn(areaId, "Nhà 1", 200))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.capacity").value(200)).andExpect(jsonPath("$.data.currentQuantity").value(80))
            .andExpect(jsonPath("$.data.status").value("ACTIVE"));
    }

    @Test
    void blocksDeletingAreaWithBarnsAndBarnsWithAnimalsOrHistory() throws Exception {
        long areaId = create(AREAS, area("Khu A"));
        long stocked = create(BARNS, barn(areaId, "Nhà 1", 100));
        stock(stocked, 30);
        long empty = create(BARNS, barn(areaId, "Nhà 2", 100));

        mvc.perform(delete(AREAS + "/" + areaId)).andExpect(status().isConflict())
            .andExpect(jsonPath("$.errorCode").value("FARM_AREA_HAS_BARNS"));
        mvc.perform(delete(BARNS + "/" + stocked)).andExpect(status().isConflict())
            .andExpect(jsonPath("$.errorCode").value("BARN_NOT_EMPTY"));
        mvc.perform(delete(BARNS + "/" + empty)).andExpect(status().isOk());

        long historyBarn = create(BARNS, barn(areaId, "Nhà 3", 100));
        create(BARNS + "/" + historyBarn + "/cycles", Map.of("startDate", LocalDate.now().toString()));
        mvc.perform(delete(BARNS + "/" + historyBarn)).andExpect(status().isConflict())
            .andExpect(jsonPath("$.errorCode").value("BARN_HAS_CYCLES"));
        mvc.perform(get(BARNS).param("areaId", "99999")).andExpect(status().isNotFound());
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
        mvc.perform(post(BARNS).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(barn(1, "Nhà 1", 10))))
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
