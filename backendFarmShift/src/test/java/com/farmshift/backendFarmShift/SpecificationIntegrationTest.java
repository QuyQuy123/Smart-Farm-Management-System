package com.farmshift.backendFarmShift;

import com.farmshift.backendFarmShift.repository.SpecificationRepository;
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
class SpecificationIntegrationTest {
    private static final String API = "/api/specifications";
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired SpecificationRepository repository;

    @BeforeEach
    void reset() {
        repository.deleteAll();
    }

    @Test
    void createsReadsUpdatesAndDeletesPersistedSpecification() throws Exception {
        var result = mvc.perform(post(API).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\" Bao 25kg thức ăn viên \",\"unit\":\" Bao \",\"items\":\" 25 kg \",\"note\":\" Chuẩn C.P. \"}"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.data.name").value("Bao 25kg thức ăn viên"))
            .andExpect(jsonPath("$.data.unit").value("Bao"))
            .andExpect(jsonPath("$.data.items").value("25 kg"))
            .andExpect(jsonPath("$.data.note").value("Chuẩn C.P."))
            .andReturn();

        long id = mapper.readTree(result.getResponse().getContentAsString()).path("data").path("id").asLong();

        mvc.perform(get(API)).andExpect(status().isOk())
            .andExpect(jsonPath("$.data.length()").value(1));

        mvc.perform(put(API + "/" + id).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Thùng 102 con\",\"unit\":\"Thùng\",\"items\":\"102 con\",\"note\":\"Cập nhật\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.name").value("Thùng 102 con"))
            .andExpect(jsonPath("$.data.items").value("102 con"));

        mvc.perform(delete(API + "/" + id)).andExpect(status().isOk());
        assertEquals(0, repository.count());
    }

    @Test
    void rejectsDuplicateNameCaseInsensitively() throws Exception {
        mvc.perform(post(API).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Chai 1L\",\"unit\":\"Chai\",\"items\":\"1L\"}"))
            .andExpect(status().isCreated());

        mvc.perform(post(API).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"  chai 1l  \"}"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.errorCode").value("SPECIFICATION_DUPLICATE"));
    }

    @Test
    @WithMockUser(authorities = "ROLE_FARM_WORKER")
    void allowsWorkerToReadButForbidsMutations() throws Exception {
        mvc.perform(get(API)).andExpect(status().isOk());
        mvc.perform(post(API).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Lọ 1000 liều\"}"))
            .andExpect(status().isForbidden());
    }

    @Test
    @WithAnonymousUser
    void requiresAuthenticationForApi() throws Exception {
        mvc.perform(get(API)).andExpect(status().is4xxClientError());
    }
}
