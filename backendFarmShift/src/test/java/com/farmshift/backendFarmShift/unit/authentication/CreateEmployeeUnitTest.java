package com.farmshift.backendFarmShift.unit.authentication;

import com.farmshift.backendFarmShift.dto.request.EmployeeCreateRequest;
import com.farmshift.backendFarmShift.entity.Customer;
import com.farmshift.backendFarmShift.entity.Role;
import com.farmshift.backendFarmShift.exception.BadRequestException;
import com.farmshift.backendFarmShift.exception.ConflictException;
import com.farmshift.backendFarmShift.repository.AccountRepository;
import com.farmshift.backendFarmShift.repository.CustomerRepository;
import com.farmshift.backendFarmShift.repository.RoleRepository;
import com.farmshift.backendFarmShift.security.RoleNames;
import com.farmshift.backendFarmShift.service.impl.EmployeeServiceImpl;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.data.jpa.domain.Specification;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CreateEmployeeUnitTest {
    @Mock AccountRepository accountRepository;
    @Mock CustomerRepository customerRepository;
    @Mock RoleRepository roleRepository;
    @Mock PasswordEncoder passwordEncoder;
    @InjectMocks EmployeeServiceImpl service;

    @Test void UTC047_createFarmWorkerSavesAccountAndCustomer() {
        Role worker = role(RoleNames.FARM_WORKER);
        when(accountRepository.existsByEmailIgnoreCase("unit.worker.101@smartfarm.com")).thenReturn(false);
        when(roleRepository.findByName(RoleNames.FARM_WORKER)).thenReturn(Optional.of(worker));
        when(passwordEncoder.encode("Worker123")).thenReturn("encoded");
        when(accountRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(customerRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        var response = service.createEmployee(create("Unit Test Worker", "unit.worker.101@smartfarm.com", "0912345678", RoleNames.FARM_WORKER, "Worker123"));

        assertEquals("unit.worker.101@smartfarm.com", response.getEmail());
        assertEquals(RoleNames.FARM_WORKER, response.getRoleName());
        assertTrue(response.getIsActive()); verify(customerRepository).save(argThat(c -> "0912345678".equals(c.getPhone())));
    }

    @Test void UTC048_createAccountantSavesSelectedRole() {
        Role accountant = role(RoleNames.ACCOUNTANT);
        when(accountRepository.existsByEmailIgnoreCase("unit.accountant.101@smartfarm.com")).thenReturn(false);
        when(roleRepository.findByName(RoleNames.ACCOUNTANT)).thenReturn(Optional.of(accountant));
        when(passwordEncoder.encode("Accountant123")).thenReturn("encoded");
        when(accountRepository.save(any())).thenAnswer(i -> i.getArgument(0)); when(customerRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        var response = service.createEmployee(create("Unit Test Accountant", "unit.accountant.101@smartfarm.com", "0987654321", RoleNames.ACCOUNTANT, "Accountant123"));
        assertEquals(RoleNames.ACCOUNTANT, response.getRoleName());
    }

    @Test void UTC049_blankPasswordUsesDefault123456() {
        when(accountRepository.existsByEmailIgnoreCase("unit.worker.102@smartfarm.com")).thenReturn(false);
        when(roleRepository.findByName(RoleNames.FARM_WORKER)).thenReturn(Optional.of(role(RoleNames.FARM_WORKER)));
        when(passwordEncoder.encode("123456")).thenReturn("encoded-default");
        when(accountRepository.save(any())).thenAnswer(i -> i.getArgument(0)); when(customerRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        service.createEmployee(create("Default Password Worker", "unit.worker.102@smartfarm.com", null, RoleNames.FARM_WORKER, ""));
        verify(passwordEncoder).encode("123456");
    }

    @Test void UTC050_duplicateEmailIsRejected() {
        when(accountRepository.existsByEmailIgnoreCase("congnhan@smartfarm.com")).thenReturn(true);
        assertThrows(ConflictException.class, () -> service.createEmployee(create("Duplicate Email Worker", "congnhan@smartfarm.com", "0916735678", RoleNames.FARM_WORKER, "Worker123")));
        verify(accountRepository, never()).save(any());
    }

    @Test void UTC051_invalidEmailIsRejectedByRequestValidation() {
        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
        assertFalse(validator.validate(create("Invalid Email Worker", "unit.worker.103", "0918295678", RoleNames.FARM_WORKER, "Worker123")).isEmpty());
    }

    @Test void UTC052_passwordShorterThanSixCharactersIsRejected() {
        when(accountRepository.existsByEmailIgnoreCase("unit.worker.104@smartfarm.com")).thenReturn(false);
        when(roleRepository.findByName(RoleNames.FARM_WORKER)).thenReturn(Optional.of(role(RoleNames.FARM_WORKER)));
        assertThrows(BadRequestException.class, () -> service.createEmployee(create("Short Password Worker", "unit.worker.104@smartfarm.com", "0912211678", RoleNames.FARM_WORKER, "12345")));
    }

    @Test void UTC053_phoneWithNineDigitsIsRejectedWithTheExpectedValidationMessage() {
        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
        var violations = validator.validate(create("Invalid Phone Worker", "unit.worker.105@smartfarm.com", "091234567", RoleNames.FARM_WORKER, "Worker123"));
        assertFalse(violations.isEmpty());
        assertEquals("Phone number must be 10-11 digits", violations.iterator().next().getMessage());
    }

    @Test void UTC054_blankFullNameFailsRequestValidation() {
        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
        assertFalse(validator.validate(create(" ", "unit.worker.106@smartfarm.com", "0912735678", RoleNames.FARM_WORKER, "Worker123")).isEmpty());
    }

    @Test void UTC055_passwordOverDocumentedMaximumIsRejected() {
        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
        var request = create("Unit Test Worker", "unit.worker.107@smartfarm.com", "0912351278", RoleNames.FARM_WORKER, "P".repeat(65));
        assertFalse(validator.validate(request).isEmpty(), "Password length is outside the documented range.");
    }

    @Test void UTC056_phoneAlreadyUsedByAnotherEmployeeIsRejected() {
        when(accountRepository.existsByEmailIgnoreCase("unit.worker.111@smartfarm.com")).thenReturn(false);
        lenient().when(roleRepository.findByName(RoleNames.FARM_WORKER)).thenReturn(Optional.of(role(RoleNames.FARM_WORKER)));
        Customer existingCustomer = new Customer(); existingCustomer.setPhone("0912345678");
        lenient().when(customerRepository.findAll(any(Specification.class))).thenReturn(List.of(existingCustomer));
        lenient().when(passwordEncoder.encode("Worker123")).thenReturn("encoded");
        lenient().when(accountRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        lenient().when(customerRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        assertThrows(ConflictException.class, () -> service.createEmployee(create(
                "Duplicate Phone Number", "unit.worker.111@smartfarm.com", "0912345678", RoleNames.FARM_WORKER, "Worker123")));
    }

    private static Role role(String name) { Role role = new Role(); role.setId(7L); role.setName(name); return role; }
    private static EmployeeCreateRequest create(String name, String email, String phone, String role, String password) {
        return EmployeeCreateRequest.builder().fullName(name).email(email).phone(phone).roleName(role).password(password).build();
    }
}
