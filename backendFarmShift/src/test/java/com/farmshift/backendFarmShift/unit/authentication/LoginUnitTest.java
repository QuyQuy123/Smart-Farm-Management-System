package com.farmshift.backendFarmShift.unit.authentication;

import com.farmshift.backendFarmShift.dto.request.LoginRequest;
import com.farmshift.backendFarmShift.entity.Account;
import com.farmshift.backendFarmShift.entity.Role;
import com.farmshift.backendFarmShift.repository.AccountRepository;
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
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class LoginUnitTest {
    @Mock AuthenticationManager authenticationManager;
    @Mock JwtProvider jwtProvider;
    @Mock AccountRepository accountRepository;
    @Mock com.farmshift.backendFarmShift.repository.OtpTokenRepository otpTokenRepository;
    @Mock PasswordEncoder passwordEncoder;
    @Mock EmailService emailService;
    @InjectMocks AuthServiceImpl service;

    @Test void UTC001_loginWithValidCredentials_returnsTokenAndRole() {
        LoginRequest request = request("mienbinh@smartfarm.com", "123456");
        Authentication auth = UsernamePasswordAuthenticationToken.authenticated(request.getEmail(), null, java.util.List.of());
        Account account = account("mienbinh@smartfarm.com", "ROLE_FARM_OWNER");
        when(authenticationManager.authenticate(any())).thenReturn(auth);
        when(jwtProvider.generateToken(auth)).thenReturn("jwt-token");
        when(accountRepository.findByEmail("mienbinh@smartfarm.com")).thenReturn(Optional.of(account));

        var result = service.login(request);

        assertEquals("jwt-token", result.getAccessToken());
        assertEquals("mienbinh@smartfarm.com", result.getEmail());
        assertEquals("ROLE_FARM_OWNER", result.getRole());
    }

    @Test void UTC002_loginWithWrongPassword_isRejectedBySecurity() {
        when(authenticationManager.authenticate(any())).thenThrow(new BadCredentialsException("Bad credentials"));
        assertThrows(BadCredentialsException.class, () -> service.login(request("mienbinh@smartfarm.com", "Wrong123")));
    }

    @Test void UTC003_loginWithUnknownEmail_isRejectedBySecurity() {
        when(authenticationManager.authenticate(any())).thenThrow(new BadCredentialsException("Bad credentials"));
        assertThrows(BadCredentialsException.class, () -> service.login(request("mien@smartfarm.com", "123456")));
    }

    @Test void UTC004_loginWithInactiveAccount_isRejectedBySecurity() {
        when(authenticationManager.authenticate(any())).thenThrow(new DisabledException("Account is disabled"));
        assertThrows(DisabledException.class, () -> service.login(request("hung@smartfarm.com", "123456")));
    }

    @Test void UTC005_emptyEmailIsRejectedByBeanValidation() {
        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
        assertFalse(validator.validate(request("", "123456")).isEmpty());
    }

    @Test void UTC006_emptyPasswordIsRejectedByBeanValidation() {
        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
        assertFalse(validator.validate(request("mienbinh@smartfarm.com", "")).isEmpty());
    }

    @Test void UTC007_emailWithoutAtSignIsRejectedByBeanValidation() {
        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
        assertFalse(validator.validate(request("mienbinhsmartfarm.com", "123456")).isEmpty());
    }

    @Test void UTC008_emailContainingWhitespaceIsRejectedByBeanValidation() {
        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
        assertFalse(validator.validate(request("mienbinh@smartfarm. com", "123456")).isEmpty());
    }

    @Test void UTC009_255CharacterEmailIsRejectedByValidation() {
        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
        String email = "a".repeat(243) + "@example.com";
        assertFalse(validator.validate(request(email, "123456")).isEmpty(), "Email length must not exceed the documented limit.");
    }

    static LoginRequest request(String email, String password) {
        LoginRequest request = new LoginRequest(); request.setEmail(email); request.setPassword(password); return request;
    }
    static Account account(String email, String roleName) {
        Account account = new Account(); account.setEmail(email); Role role = new Role(); role.setName(roleName); account.setRole(role); return account;
    }
}
