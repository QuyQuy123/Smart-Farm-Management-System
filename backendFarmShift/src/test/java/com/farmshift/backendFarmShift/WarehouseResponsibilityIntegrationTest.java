package com.farmshift.backendFarmShift;

import com.farmshift.backendFarmShift.entity.*;
import com.farmshift.backendFarmShift.repository.*;
import com.farmshift.backendFarmShift.security.RoleNames;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
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
import java.util.List;
import java.util.Map;
import static org.hamcrest.Matchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@WithMockUser(authorities = "ROLE_FARM_OWNER")
class WarehouseResponsibilityIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired AccountRepository accounts;
    @Autowired RoleRepository roles;
    @Autowired EntityManager entityManager;
    long first, second, a, b, accountant, inactive;

    @BeforeEach
    void setup() throws Exception {
        a = account("a.warehouse@farm.test", RoleNames.FARM_WORKER, true);
        b = account("b.warehouse@farm.test", RoleNames.FARM_WORKER, true);
        accountant = account("accountant.warehouse@farm.test", RoleNames.ACCOUNTANT, true);
        inactive = account("inactive.warehouse@farm.test", RoleNames.FARM_WORKER, false);
        first = warehouse("Kho cám thật");
        second = warehouse("Kho thuốc thật");
    }

    long account(String email, String roleName, boolean active) {
        Role role = roles.findByName(roleName).orElseGet(() -> roles.save(new Role(null, roleName, roleName)));
        Account account = new Account();
        account.setEmail(email);
        account.setFullName(email);
        account.setPassword("test");
        account.setRole(role);
        account.setIsActive(active);
        return accounts.saveAndFlush(account).getId();
    }

    long warehouse(String name) throws Exception {
        var result = mvc.perform(post("/api/warehouse-categories").contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of("name", name)))).andExpect(status().isCreated()).andReturn();
        return mapper.readTree(result.getResponse().getContentAsString()).path("data").path("id").asLong();
    }

    ResultActions assign(long id, Long... ids) throws Exception {
        return mvc.perform(put("/api/warehouse-categories/" + id + "/workers").contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of("workerIds", List.of(ids)))));
    }

    @Test
    void savesMultipleWorkersAndRestoresThemFromDatabaseAcrossWarehouses() throws Exception {
        assign(first, a, b, a).andExpect(status().isOk()).andExpect(jsonPath("$.data.length()").value(2));
        assign(second, a).andExpect(status().isOk());
        entityManager.flush();
        entityManager.clear();
        mvc.perform(get("/api/warehouse-responsibilities")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.warehouses[?(@.id == " + first + ")].workers[*].id").value(containsInAnyOrder((int) a, (int) b)))
                .andExpect(jsonPath("$.data.warehouses[?(@.id == " + second + ")].workers[*].id").value(contains((int) a)));
        assign(first).andExpect(status().isOk()).andExpect(jsonPath("$.data").isEmpty());
        mvc.perform(get("/api/warehouse-responsibilities"))
                .andExpect(jsonPath("$.data.warehouses[?(@.id == " + first + ")].workers[*]").isEmpty())
                .andExpect(jsonPath("$.data.warehouses[?(@.id == " + second + ")].workers[*].id").value(contains((int) a)));
    }

    @Test
    void rejectsInvalidWorkersWithoutChangingExistingAssignments() throws Exception {
        assign(first, a).andExpect(status().isOk());
        for (long invalid : new long[]{accountant, inactive, 99999999L}) {
            assign(first, b, invalid).andExpect(status().isBadRequest()).andExpect(jsonPath("$.errorCode").value("WORKER_NOT_AVAILABLE"));
        }
        mvc.perform(get("/api/warehouse-responsibilities"))
                .andExpect(jsonPath("$.data.warehouses[?(@.id == " + first + ")].workers[*].id").value(contains((int) a)));
        assign(99999999L, a).andExpect(status().isNotFound());
        mvc.perform(put("/api/warehouse-categories/" + first + "/workers").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void onlyOwnerCanReadAndEditAssignments() throws Exception {
        for (String role : List.of(RoleNames.FARM_WORKER, RoleNames.ACCOUNTANT)) {
            mvc.perform(get("/api/warehouse-responsibilities").with(user("other").authorities(() -> role))).andExpect(status().isForbidden());
            mvc.perform(put("/api/warehouse-categories/" + first + "/workers").with(user("other").authorities(() -> role))
                    .contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(Map.of("workerIds", List.of(a)))))
                    .andExpect(status().isForbidden());
        }
    }

    @Test
    void canDeleteAnEmptyWarehouseEvenWhenWorkersWereAssigned() throws Exception {
        assign(first, a).andExpect(status().isOk());
        mvc.perform(delete("/api/warehouse-categories/" + first)).andExpect(status().isOk());
        entityManager.flush();
        entityManager.clear();
        mvc.perform(get("/api/warehouse-responsibilities"))
                .andExpect(jsonPath("$.data.warehouses[?(@.id == " + first + ")]").isEmpty());
    }
}
