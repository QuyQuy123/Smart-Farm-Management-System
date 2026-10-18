package com.farmshift.backendFarmShift;

import com.farmshift.backendFarmShift.repository.ProductCategoryRepository;
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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@WithMockUser(authorities = "ROLE_FARM_OWNER")
class ProductCategoryIntegrationTest {
    private static final String API = "/api/product-categories";
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired ProductCategoryRepository repository;
    @Autowired jakarta.persistence.EntityManager entityManager;

    @BeforeEach
    void reset() { repository.deleteAll(); }

    @Test
    void createsReadsUpdatesAndDeletesPersistedCategory() throws Exception {
        var result = mvc.perform(post(API).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\" Kho cám \",\"description\":\" Thức ăn chăn nuôi \"}"))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.data.name").value("Kho cám"))
            .andExpect(jsonPath("$.data.itemCount").value(0)).andExpect(jsonPath("$.data.code").isNotEmpty())
            .andExpect(jsonPath("$.data.createdAt").isNotEmpty()).andReturn();
        long id = mapper.readTree(result.getResponse().getContentAsString()).path("data").path("id").asLong();
        mvc.perform(get(API)).andExpect(status().isOk()).andExpect(jsonPath("$.data.length()").value(1));
        mvc.perform(put(API + "/" + id).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Kho thuốc\",\"description\":\"Thuốc thú y\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.name").value("Kho thuốc"));
        mvc.perform(get(API + "/" + id)).andExpect(status().isOk())
            .andExpect(jsonPath("$.data.description").value("Thuốc thú y"));
        assertEquals("Kho thuốc", repository.findById(id).orElseThrow().getName());
        mvc.perform(delete(API + "/" + id)).andExpect(status().isOk());
        mvc.perform(get(API + "/" + id)).andExpect(status().isNotFound());
        assertEquals(0, repository.count());
    }

    @Test
    void rejectsBlankLongAndDuplicateNames() throws Exception {
        mvc.perform(post(API).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\" \"}"))
            .andExpect(status().isBadRequest());
        mvc.perform(post(API).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"" + "x".repeat(151) + "\"}"))
            .andExpect(status().isBadRequest());
        var result = mvc.perform(post(API).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Kho cám\"}"))
            .andExpect(status().isCreated()).andReturn();
        long id = mapper.readTree(result.getResponse().getContentAsString()).path("data").path("id").asLong();
        mvc.perform(put(API + "/" + id).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Kho cám\"}"))
            .andExpect(status().isOk());
        mvc.perform(post(API).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\" KHO CÁM \"}"))
            .andExpect(status().isConflict());
    }

    @Test
    void persistsTimeToSecondsAndOrdersByCreationTimeInsteadOfId() throws Exception {
        long[] ids = new long[2];
        String[] names = {"Kho tạo sau", "Kho tạo trước"};
        for (int i = 0; i < 2; i++) {
            var result = mvc.perform(post(API).contentType(MediaType.APPLICATION_JSON)
                    .content(mapper.writeValueAsString(java.util.Map.of("name", names[i]))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.createdAt", org.hamcrest.Matchers.matchesPattern(".*T\\d{2}:\\d{2}:\\d{2}.*")))
                .andReturn();
            ids[i] = mapper.readTree(result.getResponse().getContentAsString()).path("data").path("id").asLong();
            entityManager.createNativeQuery("update product_categories set created_at = :time where id = :id")
                .setParameter("time", java.sql.Timestamp.valueOf(i == 0 ? "2026-10-18 09:30:25" : "2026-10-18 09:30:05"))
                .setParameter("id", ids[i]).executeUpdate();
        }
        entityManager.clear();
        mvc.perform(get(API)).andExpect(status().isOk())
            .andExpect(jsonPath("$.data[0].name").value("Kho tạo trước"))
            .andExpect(jsonPath("$.data[1].name").value("Kho tạo sau"));
        var original = repository.findById(ids[1]).orElseThrow().getCreatedAt();
        mvc.perform(put(API + "/" + ids[1]).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Kho đổi tên\"}"))
            .andExpect(status().isOk());
        entityManager.clear();
        assertEquals(original, repository.findById(ids[1]).orElseThrow().getCreatedAt());
    }

    @Test
    @WithMockUser(authorities = "ROLE_FARM_WORKER")
    void workerCanReadButCannotWrite() throws Exception {
        mvc.perform(get(API)).andExpect(status().isOk());
        mvc.perform(post(API).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Kho cám\"}"))
            .andExpect(status().isForbidden());
        mvc.perform(put(API + "/1").contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Kho cám\"}"))
            .andExpect(status().isForbidden());
        mvc.perform(delete(API + "/1")).andExpect(status().isForbidden());
    }

    @Test
    @WithAnonymousUser
    void requiresAuthentication() throws Exception {
        mvc.perform(get(API)).andExpect(status().is4xxClientError());
    }
}
