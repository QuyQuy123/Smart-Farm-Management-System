package com.farmshift.backendFarmShift;

import com.farmshift.backendFarmShift.entity.ProductType;
import com.farmshift.backendFarmShift.repository.ProductTypeRepository;
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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@WithMockUser(authorities = "ROLE_FARM_OWNER")
class ProductTypeIntegrationTest {
    private static final String API = "/api/product-types";
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired ProductTypeRepository repository;

    @BeforeEach
    void reset() {
        repository.deleteAll();
    }

    @Test
    void createsReadsUpdatesAndDeletesPersistedProductType() throws Exception {
        var result = mvc.perform(post(API).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\" Thức ăn chăn nuôi \",\"description\":\" Cám các loại \",\"quantity\":120}"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.data.name").value("Thức ăn chăn nuôi"))
            .andExpect(jsonPath("$.data.description").value("Cám các loại"))
            .andExpect(jsonPath("$.data.quantity").value(120))
            .andExpect(jsonPath("$.data.code", org.hamcrest.Matchers.startsWith("LH")))
            .andReturn();

        long id = mapper.readTree(result.getResponse().getContentAsString()).path("data").path("id").asLong();

        // Verify database column code is set
        ProductType inDb = repository.findById(id).orElseThrow();
        assertNotNull(inDb.getCode());
        assertEquals("Thức ăn chăn nuôi", inDb.getName());
        assertEquals(120, inDb.getQuantity());

        mvc.perform(get(API)).andExpect(status().isOk())
            .andExpect(jsonPath("$.data.length()").value(1));

        mvc.perform(put(API + "/" + id).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Thuốc thú y\",\"description\":\"Dược phẩm thú y\",\"quantity\":80}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.name").value("Thuốc thú y"))
            .andExpect(jsonPath("$.data.quantity").value(80));

        mvc.perform(get(API + "/" + id)).andExpect(status().isOk())
            .andExpect(jsonPath("$.data.name").value("Thuốc thú y"))
            .andExpect(jsonPath("$.data.description").value("Dược phẩm thú y"));

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
                .content("{\"name\":\"Thức ăn\"}"))
            .andExpect(status().isCreated());

        mvc.perform(post(API).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\" THỨC ĂN \"}"))
            .andExpect(status().isConflict());
    }

    @Test
    @WithMockUser(authorities = "ROLE_FARM_WORKER")
    void workerCanReadButCannotWrite() throws Exception {
        var type = new ProductType();
        type.setName("Vắc-xin");
        type.setNameKey("vắc-xin");
        type.setCode("LH000001");
        type = repository.saveAndFlush(type);

        mvc.perform(get(API)).andExpect(status().isOk());
        mvc.perform(post(API).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Hóa chất\"}"))
            .andExpect(status().isForbidden());
        mvc.perform(put(API + "/" + type.getId()).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Updated\"}"))
            .andExpect(status().isForbidden());
        mvc.perform(delete(API + "/" + type.getId())).andExpect(status().isForbidden());
    }

    @Test
    @WithAnonymousUser
    void requiresAuthentication() throws Exception {
        mvc.perform(get(API)).andExpect(status().is4xxClientError());
    }
}
