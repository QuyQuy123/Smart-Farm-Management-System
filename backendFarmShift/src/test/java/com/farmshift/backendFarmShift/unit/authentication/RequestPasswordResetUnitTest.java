package com.farmshift.backendFarmShift.unit.authentication;

import com.farmshift.backendFarmShift.dto.request.ForgotPasswordRequest;
import com.farmshift.backendFarmShift.entity.Account;
import com.farmshift.backendFarmShift.entity.OtpToken;
import com.farmshift.backendFarmShift.exception.BadRequestException;
import com.farmshift.backendFarmShift.exception.ResourceNotFoundException;
import com.farmshift.backendFarmShift.repository.AccountRepository;
import com.farmshift.backendFarmShift.repository.OtpTokenRepository;
import com.farmshift.backendFarmShift.security.JwtProvider;
import com.farmshift.backendFarmShift.service.EmailService;
import com.farmshift.backendFarmShift.service.impl.AuthServiceImpl;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RequestPasswordResetUnitTest {
    @Mock AuthenticationManager authenticationManager;
    @Mock JwtProvider jwtProvider;
    @Mock AccountRepository accountRepository;
    @Mock OtpTokenRepository otpTokenRepository;
    @Mock PasswordEncoder passwordEncoder;
    @Mock EmailService emailService;
    @InjectMocks AuthServiceImpl service;

    @Test void UTC010_requestResetForRegisteredEmailSavesAndEmailsSixDigitOtp() {
        when(accountRepository.existsByEmail("dg.hungdung@gmail.com")).thenReturn(true);
        service.requestPasswordReset(request("DG.HungDung@gmail.com"));
        ArgumentCaptor<OtpToken> captor = ArgumentCaptor.forClass(OtpToken.class);
        verify(otpTokenRepository).invalidateAllByEmail("dg.hungdung@gmail.com");
        verify(otpTokenRepository).save(captor.capture());
        OtpToken saved = captor.getValue();
        assertTrue(saved.getCode().matches("\\d{6}"));
        assertFalse(saved.isUsed());
        assertTrue(saved.getExpiresAt().isAfter(LocalDateTime.now().plusMinutes(4)));
        verify(emailService).sendOtpEmail("dg.hungdung@gmail.com", saved.getCode());
    }

    @Test void UTC012_requestResetForUnknownEmailThrowsNotFound() {
        when(accountRepository.existsByEmail("binh@smartfarm.com")).thenReturn(false);
        assertThrows(ResourceNotFoundException.class, () -> service.requestPasswordReset(request("binh@smartfarm.com")));
        verifyNoInteractions(otpTokenRepository, emailService);
    }

    @Test void UTC013_requestResetEmailWithWhitespaceIsRejectedByBeanValidation() {
        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
        assertFalse(validator.validate(request(" dg.hungdung@gmail.com ")).isEmpty());
    }

    @Test void UTC014_255CharacterEmailIsRejectedByValidation() {
        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
        String email = "a".repeat(243) + "@example.com";
        assertFalse(validator.validate(request(email)).isEmpty(), "Email length must not exceed the documented limit.");
    }

    @Test void UTC011_inactiveAccountCannotRequestPasswordReset() {
        Account inactive = new Account();
        inactive.setEmail("hung@smartfarm.com");
        inactive.setIsActive(false);
        when(accountRepository.existsByEmail("hung@smartfarm.com")).thenReturn(true);
        // Lenient because the current service does not yet load/check account activity.
        lenient().when(accountRepository.findByEmail("hung@smartfarm.com")).thenReturn(java.util.Optional.of(inactive));

        BadRequestException error = assertThrows(BadRequestException.class,
                () -> service.requestPasswordReset(request("hung@smartfarm.com")));

        assertEquals("Tài khoản đang bị vô hiệu hóa.", error.getMessage());
        verify(emailService, never()).sendOtpEmail(anyString(), anyString());
    }

    private static ForgotPasswordRequest request(String email) {
        ForgotPasswordRequest request = new ForgotPasswordRequest(); request.setEmail(email); return request;
    }
}
