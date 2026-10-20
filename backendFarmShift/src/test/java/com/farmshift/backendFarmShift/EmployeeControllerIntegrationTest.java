package com.farmshift.backendFarmShift;

import com.farmshift.backendFarmShift.dto.request.EmployeeCreateRequest;
import com.farmshift.backendFarmShift.dto.request.EmployeeUpdateRequest;
import com.farmshift.backendFarmShift.dto.request.LoginRequest;
import com.farmshift.backendFarmShift.entity.Account;
import com.farmshift.backendFarmShift.entity.Customer;
import com.farmshift.backendFarmShift.entity.Role;
import com.farmshift.backendFarmShift.repository.AccountRepository;
import com.farmshift.backendFarmShift.repository.CustomerRepository;
import com.farmshift.backendFarmShift.repository.OtpTokenRepository;
import com.farmshift.backendFarmShift.repository.RoleRepository;
import com.farmshift.backendFarmShift.security.RoleNames;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** End-to-end HTTP tests for /api/employees: security, envelope, status codes, MSG codes. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class EmployeeControllerIntegrationTest {

    private static final String PASSWORD = "Password123!";
    private static final String OWNER_EMAIL = "owner@farmshift.local";
    private static final String WORKER_EMAIL = "worker@farmshift.local";

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private AccountRepository accountRepository;
    @Autowired private CustomerRepository customerRepository;
    @Autowired private OtpTokenRepository otpTokenRepository;
    @Autowired private RoleRepository roleRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    @MockitoBean private JavaMailSender mailSender;

    private Long workerId;

    @BeforeEach
    void setUp() {
        customerRepository.deleteAll();
        otpTokenRepository.deleteAll();
        accountRepository.deleteAll();

        Role owner = ensureRole(RoleNames.FARM_OWNER, "Chủ trang trại");
        ensureRole(RoleNames.ACCOUNTANT, "Kế toán");
        Role worker = ensureRole(RoleNames.FARM_WORKER, "Công nhân");

        saveAccount(OWNER_EMAIL, "Miền Bính", owner, "0988111222");
        workerId = saveAccount(WORKER_EMAIL, "Lê Công Nhân", worker, "0966333444").getId();
    }

    private Role ensureRole(String name, String description) {
        return roleRepository.findByName(name)
                .orElseGet(() -> roleRepository.save(new Role(null, name, description)));
    }

    private Account saveAccount(String email, String fullName, Role role, String phone) {
        Account account = new Account();
        account.setEmail(email);
        account.setPassword(passwordEncoder.encode(PASSWORD));
        account.setFullName(fullName);
        account.setRole(role);
        account.setIsActive(true);
        account = accountRepository.save(account);

        Customer customer = new Customer();
        customer.setAccount(account);
        customer.setFullName(fullName);
        customer.setPhone(phone);
        customerRepository.save(customer);
        return account;
    }

    private String token(String email) throws Exception {
        return token(email, PASSWORD);
    }

    private String token(String email, String password) throws Exception {
        LoginRequest login = new LoginRequest();
        login.setEmail(email);
        login.setPassword(password);
        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(login)))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode root = objectMapper.readTree(result.getResponse().getContentAsString());
        return "Bearer " + root.path("data").path("accessToken").asText();
    }

    @Test
    @DisplayName("Owner lists employees and filters by keyword (phone), role and status")
    void listAndFilter() throws Exception {
        String auth = token(OWNER_EMAIL);

        mockMvc.perform(get("/api/employees").header("Authorization", auth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data", hasSize(2)))
                .andExpect(jsonPath("$.data[0].password").doesNotExist());

        mockMvc.perform(get("/api/employees").param("keyword", "0966").header("Authorization", auth))
                .andExpect(jsonPath("$.data", hasSize(1)))
                .andExpect(jsonPath("$.data[0].email").value(WORKER_EMAIL));

        mockMvc.perform(get("/api/employees").param("role", RoleNames.FARM_WORKER).header("Authorization", auth))
                .andExpect(jsonPath("$.data", hasSize(1)))
                .andExpect(jsonPath("$.data[0].roleName").value(RoleNames.FARM_WORKER));

        mockMvc.perform(get("/api/employees").param("isActive", "false").header("Authorization", auth))
                .andExpect(jsonPath("$.data", hasSize(0)));
    }

    @Test
    @DisplayName("Multi-threaded summary endpoint returns concurrent distribution metrics")
    void summaryMetricsConcurrently() throws Exception {
        String auth = token(OWNER_EMAIL);

        mockMvc.perform(get("/api/employees/summary").header("Authorization", auth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.total").value(2))
                .andExpect(jsonPath("$.data.active").value(2))
                .andExpect(jsonPath("$.data.inactive").value(0))
                .andExpect(jsonPath("$.data.ownerCount").value(1))
                .andExpect(jsonPath("$.data.workerCount").value(1));
    }

    @Test
    @DisplayName("Non-owner receives 403 with MSG05")
    void workerIsForbidden() throws Exception {
        mockMvc.perform(get("/api/employees").header("Authorization", token(WORKER_EMAIL)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.errorCode").value("MSG05"));
    }

    @Test
    @DisplayName("Owner creates an accountant (201) who can then log in; duplicate email yields 409 MSG47")
    void createEmployee() throws Exception {
        String auth = token(OWNER_EMAIL);
        EmployeeCreateRequest request = EmployeeCreateRequest.builder()
                .fullName("Trần Kế Toán")
                .email("New.Accountant@FarmShift.local")
                .phone("0977222333")
                .password(PASSWORD)
                .roleName(RoleNames.ACCOUNTANT)
                .build();

        mockMvc.perform(post("/api/employees")
                        .header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.email").value("new.accountant@farmshift.local"))
                .andExpect(jsonPath("$.data.roleName").value(RoleNames.ACCOUNTANT))
                .andExpect(jsonPath("$.data.isActive").value(true));

        token("new.accountant@farmshift.local");

        mockMvc.perform(post("/api/employees")
                        .header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errorCode").value("MSG47"))
                .andExpect(jsonPath("$.data.email").exists());
    }

    @Test
    @DisplayName("Create employee with blank password defaults to 123456 and allows login")
    void createEmployeeWithDefaultPassword() throws Exception {
        String auth = token(OWNER_EMAIL);
        EmployeeCreateRequest request = EmployeeCreateRequest.builder()
                .fullName("Lê Mặc Định")
                .email("default.worker@farmshift.local")
                .password("") // left blank
                .roleName(RoleNames.FARM_WORKER)
                .build();

        mockMvc.perform(post("/api/employees")
                        .header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.email").value("default.worker@farmshift.local"));

        // Verify that the worker can log in using default password "123456"
        token("default.worker@farmshift.local", "123456");
    }

    @Test
    @DisplayName("Create validates payload (400) and rejects the owner role (400 MSG48)")
    void createValidation() throws Exception {
        String auth = token(OWNER_EMAIL);

        EmployeeCreateRequest invalid = EmployeeCreateRequest.builder()
                .fullName("").email("not-an-email").password("short").roleName(RoleNames.FARM_WORKER).build();
        mockMvc.perform(post("/api/employees")
                        .header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalid)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data.fullName").exists())
                .andExpect(jsonPath("$.data.email").exists())
                .andExpect(jsonPath("$.data.password").exists());

        EmployeeCreateRequest ownerRole = EmployeeCreateRequest.builder()
                .fullName("Chủ phụ").email("second.owner@farmshift.local")
                .password(PASSWORD).roleName(RoleNames.FARM_OWNER).build();
        mockMvc.perform(post("/api/employees")
                        .header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(ownerRole)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("MSG48"));
    }

    @Test
    @DisplayName("Owner views details, changes role and deactivates; deactivated user cannot log in")
    void detailAndUpdate() throws Exception {
        String auth = token(OWNER_EMAIL);

        mockMvc.perform(get("/api/employees/{id}", workerId).header("Authorization", auth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.phone").value("0966333444"));

        EmployeeUpdateRequest update = EmployeeUpdateRequest.builder()
                .fullName("Lê Kế Toán")
                .email(WORKER_EMAIL)
                .phone("0900000000")
                .roleName(RoleNames.ACCOUNTANT)
                .isActive(false)
                .build();

        mockMvc.perform(put("/api/employees/{id}", workerId)
                        .header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(update)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.roleName").value(RoleNames.ACCOUNTANT))
                .andExpect(jsonPath("$.data.isActive").value(false))
                .andExpect(jsonPath("$.data.phone").value("0900000000"));

        LoginRequest login = new LoginRequest();
        login.setEmail(WORKER_EMAIL);
        login.setPassword(PASSWORD);
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(login)))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/employees/{id}", 999_999L).header("Authorization", auth))
                .andExpect(status().isNotFound());
    }
}
