package com.farmshift.backendFarmShift.unit.authentication;

import com.farmshift.backendFarmShift.dto.request.EmployeeUpdateRequest;
import com.farmshift.backendFarmShift.entity.Account;
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
import org.springframework.data.jpa.domain.Specification;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UpdateEmployeeUnitTest {
    @Mock AccountRepository accountRepository;
    @Mock CustomerRepository customerRepository;
    @Mock RoleRepository roleRepository;
    @Mock PasswordEncoder passwordEncoder;
    @InjectMocks EmployeeServiceImpl service;

    @Test void UTC057_updateEmployeeProfileSucceeds() {
        Account account = account(4L, "ketoan@smartfarm.com", RoleNames.ACCOUNTANT);
        Customer customer = customer(account, "0977222233"); stubExisting(account, customer);
        when(accountRepository.save(account)).thenAnswer(i -> i.getArgument(0));
        when(customerRepository.save(customer)).thenAnswer(i -> i.getArgument(0));

        var response = service.updateEmployee(4L, request("Trần Kế Toán Updated", "ketoan@smartfarm.com", "0977222233", null, true));

        assertEquals("Trần Kế Toán Updated", response.getFullName());
        assertTrue(response.getIsActive()); verify(accountRepository).save(account); verify(customerRepository).save(customer);
    }

    @Test void UTC058_updateEmployeeRoleAndStatusSucceeds() {
        Account account = account(4L, "ketoan@smartfarm.com", RoleNames.ACCOUNTANT);
        Customer customer = customer(account, "0977222233"); stubExisting(account, customer);
        Role worker = role(RoleNames.FARM_WORKER);
        when(roleRepository.findByName(RoleNames.FARM_WORKER)).thenReturn(Optional.of(worker));
        when(accountRepository.save(account)).thenAnswer(i -> i.getArgument(0)); when(customerRepository.save(customer)).thenAnswer(i -> i.getArgument(0));

        var response = service.updateEmployee(4L, request("Trần Kế Toán", "ketoan@smartfarm.com", "0977222233", RoleNames.FARM_WORKER, false));

        assertEquals(RoleNames.FARM_WORKER, response.getRoleName()); assertFalse(response.getIsActive());
    }

    @Test void UTC059_duplicateEmailOwnedByAnotherAccountIsRejected() {
        Account account = account(4L, "employee@smartfarm.com", RoleNames.FARM_WORKER);
        when(accountRepository.findById(4L)).thenReturn(Optional.of(account));
        when(accountRepository.existsByEmailIgnoreCaseAndIdNot("congnhan@smartfarm.com", 4L)).thenReturn(true);
        assertThrows(ConflictException.class, () -> service.updateEmployee(4L,
                request("Trần Kế Toán", "congnhan@smartfarm.com", "0977222233", RoleNames.ACCOUNTANT, true)));
    }

    @Test void UTC060_blankFullNameFailsRequestValidation() {
        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
        assertFalse(validator.validate(request(" ", "ketoan@smartfarm.com", "0977222233", null, true)).isEmpty());
    }

    @Test void UTC061_malformedEmailFailsRequestValidation() {
        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
        assertFalse(validator.validate(request("Trần Kế Toán", "invalid-email", "0977222233", null, true)).isEmpty());
    }

    @Test void UTC062_phoneShorterThanTenDigitsFailsRequestValidation() {
        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
        assertFalse(validator.validate(request("Trần Kế Toán", "ketoan@smartfarm.com", "09772222", null, true)).isEmpty());
    }

    @Test void UTC063_updateEmployeeCannotUseAnotherEmployeesPhoneNumber() {
        Account account = account(4L, "employee@smartfarm.com", RoleNames.FARM_WORKER);
        Customer customer = customer(account, "0977222233");
        when(accountRepository.findById(4L)).thenReturn(Optional.of(account));
        Customer anotherEmployee = new Customer(); anotherEmployee.setPhone("0966333555");
        lenient().when(customerRepository.findAll(any(Specification.class))).thenReturn(List.of(anotherEmployee));
        lenient().when(accountRepository.save(account)).thenAnswer(i -> i.getArgument(0));
        lenient().when(customerRepository.save(customer)).thenAnswer(i -> i.getArgument(0));
        assertThrows(ConflictException.class, () -> service.updateEmployee(4L,
                request("Worker", "employee@smartfarm.com", "0966333555", null, true)));
    }

    @Test void UTC064_farmOwnerCannotBeDeactivated() {
        Account owner = account(2L, "mienbinh@smartfarm.com", RoleNames.FARM_OWNER);
        when(accountRepository.findById(2L)).thenReturn(Optional.of(owner));
        assertThrows(BadRequestException.class, () -> service.updateEmployee(2L,
                request("Miền Bình", "mienbinh@smartfarm.com", "0988111222", RoleNames.FARM_OWNER, false)));
        verify(accountRepository, never()).save(any());
    }

    @Test void updateEmployee_avatarUrlIsSavedWithTheEmployeeProfile() {
        Account account = account(4L, "ketoan@smartfarm.com", RoleNames.ACCOUNTANT);
        Customer customer = customer(account, "0977222233"); stubExisting(account, customer);
        when(accountRepository.save(account)).thenAnswer(i -> i.getArgument(0)); when(customerRepository.save(customer)).thenAnswer(i -> i.getArgument(0));
        EmployeeUpdateRequest input = request("Trần Kế Toán", "ketoan@smartfarm.com", "0977222233", null, true);
        input.setAvatarUrl("/uploads/employee.png");
        var response = service.updateEmployee(4L, input);
        assertEquals("/uploads/employee.png", response.getAvatarUrl());
    }

    @Test void UTC068_fullName255CharactersIsAcceptedAtTheDocumentedBoundary() {
        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
        assertTrue(validator.validate(request("N".repeat(255), "employee@smartfarm.com", "0977222233", null, true)).isEmpty());
    }

    @Test void UTC069_fullName256CharactersIsRejected() {
        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
        assertFalse(validator.validate(request("N".repeat(256), "employee@smartfarm.com", "0977222233", null, true)).isEmpty());
    }

    @Test void UTC070_email255CharactersIsAcceptedAtTheDocumentedBoundary() {
        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
        assertTrue(validator.validate(request("Trần Kế Toán", "a".repeat(243) + "@example.com", "0977222233", null, true)).isEmpty());
    }

    @Test void UTC071_email256CharactersIsRejected() {
        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
        assertFalse(validator.validate(request("Trần Kế Toán", "a".repeat(244) + "@example.com", "0977222233", null, true)).isEmpty());
    }

    private void stubExisting(Account account, Customer customer) {
        when(accountRepository.findById(account.getId())).thenReturn(Optional.of(account));
        when(customerRepository.findByAccount(account)).thenReturn(Optional.of(customer));
    }
    private static Account account(Long id, String email, String roleName) {
        Account a = new Account(); a.setId(id); a.setEmail(email); a.setFullName("Existing"); a.setIsActive(true); a.setAvatarUrl("/old.png"); a.setRole(role(roleName)); return a;
    }
    private static Customer customer(Account account, String phone) {
        Customer c = new Customer(); c.setAccount(account); c.setFullName(account.getFullName()); c.setPhone(phone); c.setAvatarUrl(account.getAvatarUrl()); return c;
    }
    private static Role role(String name) { Role r = new Role(); r.setId(5L); r.setName(name); return r; }
    private static EmployeeUpdateRequest request(String name, String email, String phone, String role, Boolean active) {
        return EmployeeUpdateRequest.builder().fullName(name).email(email).phone(phone).roleName(role).isActive(active).build();
    }
}
