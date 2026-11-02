package com.farmshift.backendFarmShift.unit.authentication;

import com.farmshift.backendFarmShift.dto.request.ChangePasswordRequest;
import com.farmshift.backendFarmShift.entity.Account;
import com.farmshift.backendFarmShift.repository.AccountRepository;
import com.farmshift.backendFarmShift.repository.CustomerRepository;
import com.farmshift.backendFarmShift.service.impl.UserServiceImpl;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ChangePasswordUnitTest {
    @Mock AccountRepository accountRepository;
    @Mock CustomerRepository customerRepository;
    @Mock PasswordEncoder passwordEncoder;
    @InjectMocks UserServiceImpl service;

    @Test void UTC037_changePasswordWithCorrectCurrentPasswordSucceeds() {
        Account account = account();
        when(accountRepository.findByEmail(account.getEmail())).thenReturn(Optional.of(account));
        when(passwordEncoder.matches("123456", "old-hash")).thenReturn(true);
        when(passwordEncoder.encode("NewPass123")).thenReturn("new-hash");

        assertDoesNotThrow(() -> service.changePassword(account.getEmail(), request("123456", "NewPass123")));
        assertEquals("new-hash", account.getPassword()); verify(accountRepository).save(account);
    }

    @Test void UTC038_changePasswordWithWrongCurrentPasswordIsRejected() {
        Account account = account(); when(accountRepository.findByEmail(account.getEmail())).thenReturn(Optional.of(account));
        when(passwordEncoder.matches("123456789", "old-hash")).thenReturn(false);
        var error = assertThrows(com.farmshift.backendFarmShift.exception.BadRequestException.class,
                () -> service.changePassword(account.getEmail(), request("123456789", "NewPass123")));
        assertEquals("Incorrect current password.", error.getMessage());
        verify(accountRepository, never()).save(any());
    }

    @Test void UTC039_blankCurrentPasswordIsRejectedByBeanValidation() {
        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
        assertFalse(validator.validate(request("", "NewPass123")).isEmpty());
    }

    @Test void UTC040_newPasswordShorterThanEightCharactersIsRejectedByBeanValidation() {
        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
        assertFalse(validator.validate(request("123456", "NewPass")).isEmpty());
    }

    @Test void UTC042_blankNewPasswordIsRejectedByBeanValidation() {
        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
        assertFalse(validator.validate(request("123456", "")).isEmpty());
    }

    // UTC041 and UTC043 are frontend-only confirmation checks; ChangePasswordRequest has no confirmation field.
    @Test void UTC044_passwordContainingWhitespaceIsRejectedByValidation() {
        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
        assertFalse(validator.validate(request("123456", "   NewPass123   ")).isEmpty(),
                "Passwords containing whitespace must be rejected.");
    }

    @Test void UTC045_passwordLength255IsRejectedByValidation() {
        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
        assertFalse(validator.validate(request("123456", "P".repeat(255))).isEmpty(),
                "Password length must not exceed the documented maximum.");
    }

    private static Account account() { Account a = new Account(); a.setEmail("dg.hungdung@gmail.com"); a.setPassword("old-hash"); return a; }
    private static ChangePasswordRequest request(String current, String next) { return new ChangePasswordRequest(current, next); }
}
