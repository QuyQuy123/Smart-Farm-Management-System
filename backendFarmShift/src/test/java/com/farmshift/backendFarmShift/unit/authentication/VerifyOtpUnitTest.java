package com.farmshift.backendFarmShift.unit.authentication;

import com.farmshift.backendFarmShift.dto.request.VerifyOtpRequest;
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
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class VerifyOtpUnitTest {
    @Mock AuthenticationManager authenticationManager;
    @Mock JwtProvider jwtProvider;
    @Mock AccountRepository accountRepository;
    @Mock OtpTokenRepository otpTokenRepository;
    @Mock PasswordEncoder passwordEncoder;
    @Mock EmailService emailService;
    @InjectMocks AuthServiceImpl service;

    @Test void UTC015_verifyCurrentSixDigitOtpSucceedsWithoutConsumingIt() {
        OtpToken token = otp("623368"); stubToken("dg.hungdung@gmail.com", token);
        assertDoesNotThrow(() -> service.verifyOtp(request("dg.hungdung@gmail.com", "623368")));
        assertFalse(token.isUsed());
        verify(otpTokenRepository, never()).save(any());
    }

    @Test void UTC016_verifyIncorrectOtpIsRejected() {
        stubToken("dg.hungdung@gmail.com", otp("623368"));
        BadRequestException error = assertThrows(BadRequestException.class,
                () -> service.verifyOtp(request("dg.hungdung@gmail.com", "000000")));
        assertEquals("Invalid OTP code. Please try again.", error.getMessage());
    }

    @Test void UTC017_fiveDigitOtpIsRejectedByBeanValidation() {
        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
        assertFalse(validator.validate(request("dg.hungdung@gmail.com", "12345")).isEmpty());
    }

    @Test void UTC020_nondigitOtpIsRejectedByBeanValidation() {
        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
        assertFalse(validator.validate(request("dg.hungdung@gmail.com", "12A456")).isEmpty());
    }

    @Test void UTC018_inactiveAccountCannotVerifyOtp() {
        stubToken("hung@smartfarm.com", otp("623368"));
        com.farmshift.backendFarmShift.entity.Account inactive = new com.farmshift.backendFarmShift.entity.Account();
        inactive.setEmail("hung@smartfarm.com"); inactive.setIsActive(false);
        lenient().when(accountRepository.findByEmail("hung@smartfarm.com")).thenReturn(Optional.of(inactive));

        BadRequestException error = assertThrows(BadRequestException.class,
                () -> service.verifyOtp(request("hung@smartfarm.com", "623368")));

        assertEquals("Tài khoản đang bị vô hiệu hóa.", error.getMessage());
    }

    @Test void UTC019_expiredOtpIsNotReturnedByValidTokenLookup() {
        when(otpTokenRepository.findTopByEmailAndUsedFalseAndExpiresAtAfterOrderByCreatedAtDesc(eq("dg.hungdung@gmail.com"), any()))
                .thenReturn(Optional.empty());
        assertThrows(BadRequestException.class, () -> service.verifyOtp(request("dg.hungdung@gmail.com", "623368")));
    }

    private void stubToken(String email, OtpToken token) {
        when(otpTokenRepository.findTopByEmailAndUsedFalseAndExpiresAtAfterOrderByCreatedAtDesc(eq(email), any()))
                .thenReturn(Optional.of(token));
    }
    private static OtpToken otp(String code) {
        return OtpToken.builder().email("dg.hungdung@gmail.com").code(code)
                .expiresAt(LocalDateTime.now().plusMinutes(5)).used(false).build();
    }
    private static VerifyOtpRequest request(String email, String otp) {
        VerifyOtpRequest request = new VerifyOtpRequest(); request.setEmail(email); request.setOtp(otp); return request;
    }
}
