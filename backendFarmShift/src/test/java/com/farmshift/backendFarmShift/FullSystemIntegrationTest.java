package com.farmshift.backendFarmShift;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.farmshift.backendFarmShift.dto.request.*;
import com.farmshift.backendFarmShift.entity.Account;
import com.farmshift.backendFarmShift.entity.OtpToken;
import com.farmshift.backendFarmShift.entity.Role;
import com.farmshift.backendFarmShift.repository.AccountRepository;
import com.farmshift.backendFarmShift.repository.CustomerRepository;
import com.farmshift.backendFarmShift.repository.OtpTokenRepository;
import com.farmshift.backendFarmShift.repository.RoleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.http.MediaType;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doNothing;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class FullSystemIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AccountRepository accountRepository;

    @Autowired
    private OtpTokenRepository otpTokenRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private CustomerRepository customerRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @MockitoBean
    private JavaMailSender mailSender;

    private static final String TEST_EMAIL = "admin@farmshift.local";
    private static final String TEST_PASSWORD = "Password123!";

    @BeforeEach
    void setUp() {
        doNothing().when(mailSender).send(any(SimpleMailMessage.class));

        customerRepository.deleteAll();
        otpTokenRepository.deleteAll();
        accountRepository.deleteAll();

        // Create role if not exists
        Role role = roleRepository.findByName("ROLE_FARM_OWNER")
                .orElseGet(() -> roleRepository.save(new Role(null, "ROLE_FARM_OWNER", "Chủ trang trại")));

        Account account = new Account();
        account.setEmail(TEST_EMAIL);
        account.setPassword(passwordEncoder.encode(TEST_PASSWORD));
        account.setRole(role);
        account.setFullName("Chủ Trại FarmShift");
        account.setIsActive(true);
        accountRepository.save(account);
    }

    private String obtainJwtToken(String email, String password) throws Exception {
        LoginRequest loginRequest = new LoginRequest();
        loginRequest.setEmail(email);
        loginRequest.setPassword(password);

        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode root = objectMapper.readTree(result.getResponse().getContentAsString());
        return root.path("data").path("accessToken").asText();
    }

    @Test
    @DisplayName("1. Auth - Login Success with JWT token generation")
    void testLogin_Success() throws Exception {
        LoginRequest request = new LoginRequest();
        request.setEmail(TEST_EMAIL);
        request.setPassword(TEST_PASSWORD);

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.data.email").value(TEST_EMAIL))
                .andExpect(jsonPath("$.data.role").value("ROLE_FARM_OWNER"));
    }

    @Test
    @DisplayName("2. Auth - Login Failure with wrong credentials")
    void testLogin_BadCredentials() throws Exception {
        LoginRequest request = new LoginRequest();
        request.setEmail(TEST_EMAIL);
        request.setPassword("WrongPassword!");

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    @DisplayName("3. Auth - Login Validation Error with blank fields")
    void testLogin_ValidationError() throws Exception {
        LoginRequest request = new LoginRequest();
        request.setEmail("");
        request.setPassword("");

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    @DisplayName("4. Auth - Forgot Password flow generates OTP")
    void testForgotPassword_Flow() throws Exception {
        ForgotPasswordRequest request = new ForgotPasswordRequest();
        request.setEmail(TEST_EMAIL);

        mockMvc.perform(post("/api/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        var opt = otpTokenRepository.findTopByEmailAndUsedFalseAndExpiresAtAfterOrderByCreatedAtDesc(
                TEST_EMAIL, LocalDateTime.now());
        assertTrue(opt.isPresent(), "OTP should be generated in database");
        assertEquals(6, opt.get().getCode().length(), "OTP must be 6 digits");
    }

    @Test
    @DisplayName("5. Auth - Verify OTP and Reset Password complete cycle")
    void testResetPassword_CompleteFlow() throws Exception {
        // Step 1: Create OTP directly for deterministic testing
        otpTokenRepository.invalidateAllByEmail(TEST_EMAIL);
        OtpToken otpToken = new OtpToken();
        otpToken.setEmail(TEST_EMAIL);
        otpToken.setCode("123456");
        otpToken.setUsed(false);
        otpToken.setExpiresAt(LocalDateTime.now().plusMinutes(5));
        otpTokenRepository.save(otpToken);

        // Step 2: Test invalid OTP verification
        VerifyOtpRequest badOtp = new VerifyOtpRequest();
        badOtp.setEmail(TEST_EMAIL);
        badOtp.setOtp("999999");

        mockMvc.perform(post("/api/auth/verify-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(badOtp)))
                .andExpect(status().isBadRequest());

        // Step 3: Test valid OTP verification
        VerifyOtpRequest validOtp = new VerifyOtpRequest();
        validOtp.setEmail(TEST_EMAIL);
        validOtp.setOtp("123456");

        mockMvc.perform(post("/api/auth/verify-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validOtp)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        // Step 4: Perform password reset
        String newPassword = "BrandNewPassword456!";
        ResetPasswordRequest resetRequest = new ResetPasswordRequest();
        resetRequest.setEmail(TEST_EMAIL);
        resetRequest.setOtp("123456");
        resetRequest.setNewPassword(newPassword);

        mockMvc.perform(post("/api/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(resetRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        // Step 5: Verify login with new password works
        String token = obtainJwtToken(TEST_EMAIL, newPassword);
        assertNotNull(token);
        assertFalse(token.isBlank());
    }

    @Test
    @DisplayName("6. Security - Access /api/user/profile without token yields 401/403")
    void testUserProfile_Unauthorized() throws Exception {
        mockMvc.perform(get("/api/user/profile"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("7. User - Get Profile with valid JWT Token")
    void testGetProfile_Success() throws Exception {
        String token = obtainJwtToken(TEST_EMAIL, TEST_PASSWORD);

        mockMvc.perform(get("/api/user/profile")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.email").value(TEST_EMAIL))
                .andExpect(jsonPath("$.data.fullName").value("Chủ Trại FarmShift"))
                .andExpect(jsonPath("$.data.role").value("ROLE_FARM_OWNER"));
    }

    @Test
    @DisplayName("8. User - Update Profile with valid JWT Token")
    void testUpdateProfile_Success() throws Exception {
        String token = obtainJwtToken(TEST_EMAIL, TEST_PASSWORD);

        UpdateProfileRequest updateRequest = new UpdateProfileRequest();
        updateRequest.setFullName("Chủ Trại Mới Đổi Tên");
        updateRequest.setPhone("0987654321");
        updateRequest.setAddress("Khu chăn nuôi Sóc Sơn, Hà Nội");

        mockMvc.perform(put("/api/user/profile")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.fullName").value("Chủ Trại Mới Đổi Tên"))
                .andExpect(jsonPath("$.data.phone").value("0987654321"));
    }

    @Test
    @DisplayName("9. User - Change Password via Authenticated endpoint")
    void testChangePassword_Success() throws Exception {
        String token = obtainJwtToken(TEST_EMAIL, TEST_PASSWORD);

        ChangePasswordRequest request = new ChangePasswordRequest(TEST_PASSWORD, "SuperSecurePwd789!");
        mockMvc.perform(put("/api/user/password")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        // Verify login works with updated password
        String newToken = obtainJwtToken(TEST_EMAIL, "SuperSecurePwd789!");
        assertNotNull(newToken);
    }

    @Test
    @DisplayName("10. User - Get All Users list with valid token")
    void testGetAllUsers_Success() throws Exception {
        String token = obtainJwtToken(TEST_EMAIL, TEST_PASSWORD);

        mockMvc.perform(get("/api/user/all")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").isArray());
    }
}
