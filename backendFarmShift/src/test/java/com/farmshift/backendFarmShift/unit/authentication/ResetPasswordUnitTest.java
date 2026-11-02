package com.farmshift.backendFarmShift.unit.authentication;

import com.farmshift.backendFarmShift.dto.request.ResetPasswordRequest;
import com.farmshift.backendFarmShift.entity.Account;
import com.farmshift.backendFarmShift.entity.OtpToken;
import com.farmshift.backendFarmShift.exception.BadRequestException;
import com.farmshift.backendFarmShift.repository.AccountRepository;
import com.farmshift.backendFarmShift.repository.OtpTokenRepository;
import com.farmshift.backendFarmShift.security.JwtProvider;
import com.farmshift.backendFarmShift.service.EmailService;
import com.farmshift.backendFarmShift.service.impl.AuthServiceImpl;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ResetPasswordUnitTest {
    @Mock AuthenticationManager authenticationManager;
    @Mock JwtProvider jwtProvider;
    @Mock AccountRepository accountRepository;
    @Mock OtpTokenRepository otpTokenRepository;
    @Mock PasswordEncoder passwordEncoder;
    @Mock EmailService emailService;
    @InjectMocks AuthServiceImpl service;

    @Test void UTC021_resetPasswordWithValidOtpUpdatesEncodedPasswordAndConsumesOtp() {
        OtpToken token = token("623368");
        Account account = new Account(); account.setEmail("dg.hungdung@gmail.com"); account.setPassword("old-hash");
        stubToken(token); when(accountRepository.findByEmail("dg.hungdung@gmail.com")).thenReturn(Optional.of(account));
        when(passwordEncoder.encode("NewPass123")).thenReturn("new-hash");

        service.resetPassword(request("dg.hungdung@gmail.com", "623368", "NewPass123"));

        assertTrue(token.isUsed()); assertEquals("new-hash", account.getPassword());
        verify(otpTokenRepository).save(token); verify(accountRepository).save(account);
    }

    @Test void UTC022_passwordShorterThanEightCharactersIsRejectedByBeanValidation() {
        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
        assertFalse(validator.validate(request("dg.hungdung@gmail.com", "623368", "NewPass")).isEmpty());
    }

    @Test void UTC024_blankNewPasswordIsRejectedByBeanValidation() {
        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
        assertFalse(validator.validate(request("dg.hungdung@gmail.com", "623368", "")).isEmpty());
    }

    @Test void resetPassword_wrongOtpIsRejected() {
        stubToken(token("623368"));
        BadRequestException error = assertThrows(BadRequestException.class,
                () -> service.resetPassword(request("dg.hungdung@gmail.com", "000000", "NewPass123")));
        assertEquals("Invalid OTP code. Please try again.", error.getMessage());
        verify(accountRepository, never()).save(any());
    }

    // UTC023 and UTC025 are frontend-only confirm-password checks; ResetPasswordRequest has no confirmation field.

    @Test void UTC026_passwordWithSpacesIsRejectedByValidation() {
        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
        assertFalse(validator.validate(request("dg.hungdung@gmail.com", "623368", "   NewPass123   ")).isEmpty(),
                "Passwords containing whitespace must be rejected.");
    }

    @Test void UTC027_passwordLength255IsRejectedByValidation() {
        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
        assertFalse(validator.validate(request("dg.hungdung@gmail.com", "623368", "P".repeat(255))).isEmpty(),
                "Password length must not exceed the documented maximum.");
    }

    private void stubToken(OtpToken token) {
        when(otpTokenRepository.findTopByEmailAndUsedFalseAndExpiresAtAfterOrderByCreatedAtDesc(eq("dg.hungdung@gmail.com"), any()))
                .thenReturn(Optional.of(token));
    }
    private static OtpToken token(String code) {
        return OtpToken.builder().email("dg.hungdung@gmail.com").code(code)
                .expiresAt(LocalDateTime.now().plusMinutes(5)).used(false).build();
    }
    private static ResetPasswordRequest request(String email, String otp, String password) {
        ResetPasswordRequest request = new ResetPasswordRequest(); request.setEmail(email); request.setOtp(otp); request.setNewPassword(password); return request;
    }
}
