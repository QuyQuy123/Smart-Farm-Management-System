package com.farmshift.backendFarmShift;

import com.farmshift.backendFarmShift.entity.Brand;
import com.farmshift.backendFarmShift.repository.BrandRepository;
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
class BrandIntegrationTest {
    private static final String API = "/api/brands";
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired BrandRepository repository;

    @BeforeEach
    void reset() {
        repository.deleteAll();
    }

    @Test
    void createsReadsUpdatesAndDeletesPersistedBrand() throws Exception {
        var result = mvc.perform(post(API).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\" C.P. Group \",\"productType\":\" Thức ăn chăn nuôi \",\"quantity\":100,\"note\":\" Ghi chú CP \"}"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.data.name").value("C.P. Group"))
            .andExpect(jsonPath("$.data.productType").value("Thức ăn chăn nuôi"))
            .andExpect(jsonPath("$.data.quantity").value(100))
            .andExpect(jsonPath("$.data.note").value("Ghi chú CP"))
            .andExpect(jsonPath("$.data.code", org.hamcrest.Matchers.startsWith("NH")))
            .andReturn();

        long id = mapper.readTree(result.getResponse().getContentAsString()).path("data").path("id").asLong();

        mvc.perform(get(API)).andExpect(status().isOk())
            .andExpect(jsonPath("$.data.length()").value(1));

        mvc.perform(put(API + "/" + id).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Dabaco\",\"productType\":\"Con giống & Cám\",\"quantity\":50,\"note\":\"Cập nhật\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.name").value("Dabaco"))
            .andExpect(jsonPath("$.data.quantity").value(50));

        mvc.perform(get(API + "/" + id)).andExpect(status().isOk())
            .andExpect(jsonPath("$.data.name").value("Dabaco"))
            .andExpect(jsonPath("$.data.note").value("Cập nhật"));

        mvc.perform(delete(API + "/" + id)).andExpect(status().isOk());
        mvc.perform(get(API + "/" + id)).andExpect(status().isNotFound());
        assertEquals(0, repository.count());
    }

    @Test
    void rejectsBlankLongAndDuplicateNames() throws Exception {
        mvc.perform(post(API).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\" \"}"))
            .andExpect(status().isBadRequest());

        mvc.perform(post(API).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"" + "x".repeat(151) + "\"}"))
            .andExpect(status().isBadRequest());

        mvc.perform(post(API).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Dabaco\"}"))
            .andExpect(status().isCreated());

        mvc.perform(post(API).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\" DABACO \"}"))
            .andExpect(status().isConflict());
    }

    @Test
    void allowsSameBrandAcrossProductTypesButRejectsDuplicatePair() throws Exception {
        var first = mvc.perform(post(API).contentType(MediaType.APPLICATION_JSON)
            .content("{\"name\":\"Dapaco\",\"productType\":\"Feed\"}"))
            .andExpect(status().isCreated()).andReturn();
        long id = mapper.readTree(first.getResponse().getContentAsString()).path("data").path("id").asLong();
        mvc.perform(post(API).contentType(MediaType.APPLICATION_JSON)
            .content("{\"name\":\"Dapaco\",\"productType\":\"Vaccine\"}"))
            .andExpect(status().isCreated());
        mvc.perform(post(API).contentType(MediaType.APPLICATION_JSON)
            .content("{\"name\":\" DAPACO \",\"productType\":\" vaccine \"}"))
            .andExpect(status().isConflict());
        mvc.perform(put(API + "/" + id).contentType(MediaType.APPLICATION_JSON)
            .content("{\"name\":\"Dapaco\",\"productType\":\"Feed\",\"note\":\"Updated\"}"))
            .andExpect(status().isOk());
        mvc.perform(put(API + "/" + id).contentType(MediaType.APPLICATION_JSON)
            .content("{\"name\":\"Dapaco\",\"productType\":\"Vaccine\"}"))
            .andExpect(status().isConflict());
        assertEquals(2, repository.count());
    }

    @Test
    @WithMockUser(authorities = "ROLE_FARM_WORKER")
    void workerCanReadButCannotWrite() throws Exception {
        var brand = new Brand();
        brand.setName("Hanvet");
        brand.setNameKey("hanvet");
        brand = repository.saveAndFlush(brand);

        mvc.perform(get(API)).andExpect(status().isOk());
        mvc.perform(post(API).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"New Brand\"}"))
            .andExpect(status().isForbidden());
        mvc.perform(put(API + "/" + brand.getId()).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Updated\"}"))
            .andExpect(status().isForbidden());
        mvc.perform(delete(API + "/" + brand.getId())).andExpect(status().isForbidden());
    }

    @Test
    @WithAnonymousUser
    void requiresAuthentication() throws Exception {
        mvc.perform(get(API)).andExpect(status().is4xxClientError());
    }
}
