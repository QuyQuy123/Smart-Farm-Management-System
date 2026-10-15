package com.farmshift.backendFarmShift;

import com.farmshift.backendFarmShift.repository.FarmRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class FarmControllerIntegrationTest {
    @Autowired private MockMvc mvc;
    @Autowired private FarmRepository repository;

    private static final String FARM = """
        {"name":" Trang trại Miền Bính ","owner":" Miền Bính ",
         "phone":"0987 654 321","scale":"15,000 con",
         "address":"Vĩnh Phúc","type":"Chăn nuôi gia cầm"}
        """;

    @BeforeEach
    void reset() { repository.deleteAll(); }

    @Test
    @WithMockUser(authorities = "ROLE_FARM_OWNER")
    void createsThenUpdatesSameFarmAndReadsPersistedData() throws Exception {
        mvc.perform(put("/api/farm").contentType(MediaType.APPLICATION_JSON).content(FARM))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.name").value("Trang trại Miền Bính"))
            .andExpect(jsonPath("$.data.owner").value("Miền Bính"));
        mvc.perform(put("/api/farm").contentType(MediaType.APPLICATION_JSON)
                .content(FARM.replace("Miền Bính", "Tên mới")))
            .andExpect(status().isOk());
        mvc.perform(get("/api/farm"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.name").value("Trang trại Tên mới"))
            .andExpect(jsonPath("$.data.phone").value("0987 654 321"))
            .andExpect(jsonPath("$.data.scale").value("15,000 con"))
            .andExpect(jsonPath("$.data.address").value("Vĩnh Phúc"))
            .andExpect(jsonPath("$.data.type").value("Chăn nuôi gia cầm"))
            .andExpect(jsonPath("$.data.createdAt").isNotEmpty())
            .andExpect(jsonPath("$.data.updatedAt").isNotEmpty());
        assertEquals(1, repository.count());
    }

    @Test
    @WithMockUser(authorities = "ROLE_FARM_OWNER")
    void rejectsBlankRequiredFieldsAndInvalidPhone() throws Exception {
        mvc.perform(put("/api/farm").contentType(MediaType.APPLICATION_JSON)
                .content(FARM.replace(" Trang trại Miền Bính ", " ")))
            .andExpect(status().isBadRequest());
        mvc.perform(put("/api/farm").contentType(MediaType.APPLICATION_JSON)
                .content(FARM.replace("0987 654 321", "invalid")))
            .andExpect(status().isBadRequest());
        mvc.perform(put("/api/farm").contentType(MediaType.APPLICATION_JSON)
                .content(FARM.replace("0987 654 321", "-----------")))
            .andExpect(status().isBadRequest());
        mvc.perform(put("/api/farm").contentType(MediaType.APPLICATION_JSON)
                .content(FARM.replace("Vĩnh Phúc", "x".repeat(501))))
            .andExpect(status().isBadRequest());
        assertEquals(0, repository.count());
    }

    @Test
    @WithMockUser(authorities = "ROLE_FARM_WORKER")
    void workerCanReadButCannotUpdate() throws Exception {
        mvc.perform(get("/api/farm")).andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true));
        mvc.perform(put("/api/farm").contentType(MediaType.APPLICATION_JSON).content(FARM))
            .andExpect(status().isForbidden());
        assertEquals(0, repository.count());
    }

    @Test
    @WithMockUser(authorities = "ROLE_ACCOUNTANT")
    void accountantCannotUpdate() throws Exception {
        mvc.perform(put("/api/farm").contentType(MediaType.APPLICATION_JSON).content(FARM))
            .andExpect(status().isForbidden());
    }

    @Test
    void anonymousCannotReadOrUpdate() throws Exception {
        mvc.perform(get("/api/farm")).andExpect(status().is4xxClientError());
        mvc.perform(put("/api/farm").contentType(MediaType.APPLICATION_JSON).content(FARM))
            .andExpect(status().is4xxClientError());
    }
}
