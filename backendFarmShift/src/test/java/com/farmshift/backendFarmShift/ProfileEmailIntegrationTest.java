package com.farmshift.backendFarmShift;

import com.farmshift.backendFarmShift.entity.Account;
import com.farmshift.backendFarmShift.entity.Role;
import com.farmshift.backendFarmShift.repository.AccountRepository;
import com.farmshift.backendFarmShift.repository.RoleRepository;
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

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class ProfileEmailIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired AccountRepository accounts;
    @Autowired RoleRepository roles;
    @Autowired ObjectMapper mapper;

    @BeforeEach
    void setup() {
        create("email-owner@test.local", "ROLE_FARM_OWNER");
        create("email-worker@test.local", "ROLE_FARM_WORKER");
    }

    void create(String email, String roleName) {
        Role role = roles.findByName(roleName).orElseGet(() -> roles.save(new Role(null, roleName, "Test")));
        Account account = new Account();
        account.setEmail(email);
        account.setPassword("test");
        account.setFullName("Test User");
        account.setRole(role);
        accounts.saveAndFlush(account);
    }

    @Test
    @WithMockUser(username = "email-owner@test.local", authorities = "ROLE_FARM_OWNER")
    void ownerCanChangeEmailAndContinueUsingNewToken() throws Exception {
        var result = mvc.perform(put("/api/user/profile").contentType(MediaType.APPLICATION_JSON)
                .content("{\"fullName\":\"Owner\",\"email\":\"new-owner@test.local\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.email").value("new-owner@test.local"))
            .andExpect(jsonPath("$.data.token").isNotEmpty()).andReturn();
        String token = mapper.readTree(result.getResponse().getContentAsString()).path("data").path("token").asText();
        mvc.perform(get("/api/user/profile").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.email").value("new-owner@test.local"));
        assertFalse(accounts.existsByEmail("email-owner@test.local"));
    }

    @Test
    @WithMockUser(username = "email-owner@test.local", authorities = "ROLE_FARM_OWNER")
    void rejectsDuplicateAndInvalidEmail() throws Exception {
        mvc.perform(put("/api/user/profile").contentType(MediaType.APPLICATION_JSON)
                .content("{\"fullName\":\"Owner\",\"email\":\"EMAIL-WORKER@test.local\"}"))
            .andExpect(status().isConflict());
        mvc.perform(put("/api/user/profile").contentType(MediaType.APPLICATION_JSON)
                .content("{\"fullName\":\"Owner\",\"email\":\"invalid\"}"))
            .andExpect(status().isBadRequest());
        assertTrue(accounts.existsByEmail("email-owner@test.local"));
    }

    @Test
    @WithMockUser(username = "email-worker@test.local", authorities = "ROLE_FARM_WORKER")
    void workerCannotChangeEmailButCanUpdateProfileWithoutEmail() throws Exception {
        mvc.perform(put("/api/user/profile").contentType(MediaType.APPLICATION_JSON)
                .content("{\"fullName\":\"Worker\",\"email\":\"changed@test.local\"}"))
            .andExpect(status().isForbidden());
        mvc.perform(put("/api/user/profile").contentType(MediaType.APPLICATION_JSON)
                .content("{\"fullName\":\"Worker\"}"))
            .andExpect(status().isOk());
    }
}
