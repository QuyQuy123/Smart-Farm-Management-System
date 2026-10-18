package com.farmshift.backendFarmShift;

import com.farmshift.backendFarmShift.entity.CustomerContact;
import com.farmshift.backendFarmShift.repository.CustomerContactRepository;
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
import java.util.HashSet;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test") @Transactional
class CustomerContactIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired CustomerContactRepository repository;
    private static final String API = "/api/customer-contacts";
    private static final String BODY = "{\"name\":\" Nguyễn Văn A \",\"phone\":\"0912345678\"}";

    @Test @WithMockUser(authorities="ROLE_FARM_OWNER")
    void crudStoresCodeWithoutReturningIt() throws Exception {
        var result = mvc.perform(post(API).contentType(MediaType.APPLICATION_JSON).content(BODY))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.data.name").value("Nguyễn Văn A"))
            .andExpect(jsonPath("$.data.code").doesNotExist()).andReturn();
        long id = mapper.readTree(result.getResponse().getContentAsString()).path("data").path("id").asLong();
        var code = repository.findById(id).orElseThrow().getCode();
        var created = repository.findById(id).orElseThrow().getCreatedAt();
        assertTrue(code.startsWith("KH"));
        mvc.perform(put(API + "/" + id).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Nguyễn Văn B\",\"phone\":\"0987654321\"}"))
            .andExpect(status().isOk());
        mvc.perform(get(API + "/" + id)).andExpect(jsonPath("$.data.name").value("Nguyễn Văn B"));
        assertEquals(code, repository.findById(id).orElseThrow().getCode());
        assertEquals(created, repository.findById(id).orElseThrow().getCreatedAt());
        mvc.perform(delete(API + "/" + id)).andExpect(status().isOk());
        mvc.perform(get(API + "/" + id)).andExpect(status().isNotFound());
    }

    @Test @WithMockUser(authorities="ROLE_FARM_OWNER")
    void paginatesTenPerPageAndSearchesAcrossAllCustomers() throws Exception {
        for (int i = 1; i <= 21; i++) {
            var customer = new CustomerContact(); customer.setName(String.format("Khách hàng %02d", i)); customer.setPhone(String.format("09%08d", i)); repository.save(customer);
        }
        repository.flush();
        var ids = new HashSet<Long>();
        for (int page = 0; page < 3; page++) {
            var result = mvc.perform(get(API).param("page", String.valueOf(page)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.content.length()").value(page == 2 ? 1 : 10))
                .andExpect(jsonPath("$.data.totalElements").value(21)).andExpect(jsonPath("$.data.totalPages").value(3))
                .andExpect(jsonPath("$.data.size").value(10)).andReturn();
            for (var item : mapper.readTree(result.getResponse().getContentAsString()).path("data").path("content")) {
                assertFalse(item.has("code")); assertTrue(ids.add(item.path("id").asLong()));
            }
        }
        assertEquals(21, ids.size());
        mvc.perform(get(API).param("q", "Khách hàng 21")).andExpect(jsonPath("$.data.totalElements").value(1))
            .andExpect(jsonPath("$.data.content[0].name").value("Khách hàng 21"));
        mvc.perform(get(API).param("page", "-1")).andExpect(status().isBadRequest());
    }

    @Test @WithMockUser(authorities="ROLE_FARM_OWNER")
    void validatesRequiredFieldsAndPhone() throws Exception {
        mvc.perform(post(API).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\" \",\"phone\":\"0912345678\"}")).andExpect(status().isBadRequest());
        mvc.perform(post(API).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"A\",\"phone\":\"abc\"}")).andExpect(status().isBadRequest());
    }
    @Test @WithMockUser(authorities="ROLE_FARM_WORKER")
    void workerCanReadButCannotWrite() throws Exception {
        mvc.perform(get(API)).andExpect(status().isOk());
        mvc.perform(post(API).contentType(MediaType.APPLICATION_JSON).content(BODY)).andExpect(status().isForbidden());
    }
    @Test void anonymousCannotRead() throws Exception { mvc.perform(get(API)).andExpect(status().is4xxClientError()); }
}
