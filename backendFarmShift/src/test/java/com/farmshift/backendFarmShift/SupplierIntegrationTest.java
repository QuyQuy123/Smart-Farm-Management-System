package com.farmshift.backendFarmShift;

import com.farmshift.backendFarmShift.entity.ProductType;
import com.farmshift.backendFarmShift.repository.ProductTypeRepository;
import com.farmshift.backendFarmShift.repository.SupplierRepository;
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
import org.springframework.transaction.annotation.Transactional;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test") @Transactional
class SupplierIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired SupplierRepository suppliers;
    @Autowired ProductTypeRepository types;
    Long groupId;
    @BeforeEach void setup() {
        var type = new ProductType(); type.setName("Nhóm NCC kiểm thử"); type.setNameKey("nhóm ncc kiểm thử");
        groupId = types.saveAndFlush(type).getId();
    }
    String payload(String name, String phone, Long typeId) throws Exception {
        return mapper.writeValueAsString(Map.of("name", name, "representative", "Nguyễn Văn A", "phone", phone, "productTypeId", typeId));
    }
    @Test @WithMockUser(authorities="ROLE_FARM_OWNER")
    void crudStoresHiddenStableCodeAndGroupAndCreationDate() throws Exception {
        var result = mvc.perform(post("/api/suppliers").contentType(MediaType.APPLICATION_JSON).content(payload(" Nhà cung cấp A ", "0912345678", groupId)))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.data.code").doesNotExist())
            .andExpect(jsonPath("$.data.productTypeName").value("Nhóm NCC kiểm thử")).andReturn();
        long id = mapper.readTree(result.getResponse().getContentAsString()).path("data").path("id").asLong();
        var saved = suppliers.findById(id).orElseThrow();
        String code = saved.getCode(); var created = saved.getCreatedAt();
        assertTrue(code.startsWith("NCC"));
        mvc.perform(get("/api/suppliers")).andExpect(status().isOk());
        mvc.perform(delete("/api/product-types/" + groupId)).andExpect(status().isConflict());
        mvc.perform(put("/api/suppliers/" + id).contentType(MediaType.APPLICATION_JSON).content(payload("Nhà cung cấp B", "0987654321", groupId))).andExpect(status().isOk());
        mvc.perform(get("/api/suppliers/" + id)).andExpect(jsonPath("$.data.name").value("Nhà cung cấp B"));
        assertEquals(code, suppliers.findById(id).orElseThrow().getCode());
        assertEquals(created, suppliers.findById(id).orElseThrow().getCreatedAt());
        mvc.perform(delete("/api/suppliers/" + id)).andExpect(status().isOk());
        mvc.perform(get("/api/suppliers/" + id)).andExpect(status().isNotFound());
    }
    @Test @WithMockUser(authorities="ROLE_FARM_OWNER")
    void rejectsInvalidDataAndDuplicateNames() throws Exception {
        mvc.perform(post("/api/suppliers").contentType(MediaType.APPLICATION_JSON).content(payload("A", "abc", groupId))).andExpect(status().isBadRequest());
        mvc.perform(post("/api/suppliers").contentType(MediaType.APPLICATION_JSON).content(payload("A", "0912345678", 9999999L))).andExpect(status().isNotFound());
        mvc.perform(post("/api/suppliers").contentType(MediaType.APPLICATION_JSON).content(payload("NCC A", "0912345678", groupId))).andExpect(status().isCreated());
        mvc.perform(post("/api/suppliers").contentType(MediaType.APPLICATION_JSON).content(payload(" ncc a ", "0912345678", groupId))).andExpect(status().isConflict());
        mvc.perform(post("/api/suppliers").contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"A\",\"representative\":\"B\",\"phone\":\"0912345678\"}")).andExpect(status().isBadRequest());
    }
    @Test @WithMockUser(authorities="ROLE_FARM_WORKER")
    void workerCanReadButCannotMutate() throws Exception {
        mvc.perform(get("/api/suppliers")).andExpect(status().isOk());
        mvc.perform(post("/api/suppliers").contentType(MediaType.APPLICATION_JSON).content(payload("A", "0912345678", groupId))).andExpect(status().isForbidden());
        mvc.perform(delete("/api/suppliers/1")).andExpect(status().isForbidden());
    }
    @Test void anonymousCannotRead() throws Exception { mvc.perform(get("/api/suppliers")).andExpect(status().is4xxClientError()); }
}
