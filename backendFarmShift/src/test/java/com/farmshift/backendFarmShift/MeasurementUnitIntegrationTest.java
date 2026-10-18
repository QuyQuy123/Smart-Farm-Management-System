package com.farmshift.backendFarmShift;

import com.farmshift.backendFarmShift.repository.MeasurementUnitRepository;
import com.farmshift.backendFarmShift.repository.ProductCategoryRepository;
import com.farmshift.backendFarmShift.entity.ProductCategory;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test") @Transactional
class MeasurementUnitIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired MeasurementUnitRepository units;
    @Autowired ProductCategoryRepository products;
    private static final String API = "/api/measurement-units";
    private static final String BODY = "{\"code\":\" KG \",\"name\":\" Kg \",\"description\":\"Khối lượng\"}";

    private long create() throws Exception {
        var result = mvc.perform(post(API).contentType(MediaType.APPLICATION_JSON).content(BODY))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.data.code").value("KG"))
            .andExpect(jsonPath("$.data.itemCount").value(0)).andReturn();
        return mapper.readTree(result.getResponse().getContentAsString()).path("data").path("id").asLong();
    }

    @Test @WithMockUser(authorities = "ROLE_FARM_OWNER")
    void crudPreservesCreationDateAndManualCode() throws Exception {
        long id = create();
        var created = units.findById(id).orElseThrow().getCreatedAt();
        mvc.perform(get(API)).andExpect(status().isOk());
        mvc.perform(put(API + "/" + id).contentType(MediaType.APPLICATION_JSON)
                .content("{\"code\":\"KILO\",\"name\":\"Kilôgam\",\"description\":\"Đã sửa\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.code").value("KILO"));
        mvc.perform(get(API + "/" + id)).andExpect(status().isOk()).andExpect(jsonPath("$.data.name").value("Kilôgam"));
        assertEquals(created, units.findById(id).orElseThrow().getCreatedAt());
        mvc.perform(delete(API + "/" + id)).andExpect(status().isOk());
        mvc.perform(get(API + "/" + id)).andExpect(status().isNotFound());
    }

    @Test @WithMockUser(authorities = "ROLE_FARM_OWNER")
    void validatesAndRejectsDuplicateCodeAndName() throws Exception {
        create();
        mvc.perform(post(API).contentType(MediaType.APPLICATION_JSON).content("{\"code\":\"kg\",\"name\":\"Khác\"}"))
            .andExpect(status().isConflict());
        mvc.perform(post(API).contentType(MediaType.APPLICATION_JSON).content("{\"code\":\"OTHER\",\"name\":\"kg\"}"))
            .andExpect(status().isConflict());
        mvc.perform(post(API).contentType(MediaType.APPLICATION_JSON).content("{\"code\":\" \",\"name\":\"Kg\"}"))
            .andExpect(status().isBadRequest());
    }

    @Test @WithMockUser(authorities = "ROLE_FARM_OWNER")
    void countsProductsPropagatesRenameAndBlocksDeletionWhileUsed() throws Exception {
        long id = create();
        var product = new ProductCategory();
        product.setName("Cám thử"); product.setNameKey("cám thử"); product.setSpecification(" kg ");
        product = products.saveAndFlush(product);
        mvc.perform(get(API + "/" + id)).andExpect(jsonPath("$.data.itemCount").value(1));
        mvc.perform(put(API + "/" + id).contentType(MediaType.APPLICATION_JSON)
                .content("{\"code\":\"KG\",\"name\":\"Kilôgam\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.itemCount").value(1));
        assertEquals("Kilôgam", products.findById(product.getId()).orElseThrow().getSpecification());
        mvc.perform(delete(API + "/" + id)).andExpect(status().isConflict());
    }

    @Test @WithMockUser(authorities = "ROLE_FARM_WORKER")
    void workerCanReadButCannotWrite() throws Exception {
        mvc.perform(get(API)).andExpect(status().isOk());
        mvc.perform(post(API).contentType(MediaType.APPLICATION_JSON).content(BODY)).andExpect(status().isForbidden());
    }

    @Test void anonymousCannotRead() throws Exception {
        mvc.perform(get(API)).andExpect(status().is4xxClientError());
    }
}
