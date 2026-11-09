package com.farmshift.backendFarmShift.unit.authentication;

import com.farmshift.backendFarmShift.dto.request.UpdateProfileRequest;
import com.farmshift.backendFarmShift.entity.Account;
import com.farmshift.backendFarmShift.entity.Customer;
import com.farmshift.backendFarmShift.entity.Role;
import com.farmshift.backendFarmShift.exception.ConflictException;
import com.farmshift.backendFarmShift.repository.AccountRepository;
import com.farmshift.backendFarmShift.repository.CustomerRepository;
import com.farmshift.backendFarmShift.security.RoleNames;
import com.farmshift.backendFarmShift.service.impl.UserServiceImpl;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDate;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UpdateProfileUnitTest {
    @Mock AccountRepository accountRepository;
    @Mock CustomerRepository customerRepository;
    @Mock PasswordEncoder passwordEncoder;
    @InjectMocks UserServiceImpl service;

    @Test void UTC028_updateProfileSavesNameAndContactFields() {
        Account account = account("dg.hungdung@gmail.com", RoleNames.FARM_OWNER);
        when(accountRepository.findByEmail(account.getEmail())).thenReturn(Optional.of(account));
        when(accountRepository.save(any(Account.class))).thenAnswer(i -> i.getArgument(0));
        when(customerRepository.findByAccount(account)).thenReturn(Optional.empty());
        UpdateProfileRequest request = profile("Admin Updated", null, "0965122004", "030204006491", LocalDate.of(2004, 12, 5), "Hà Nội");

        var response = service.updateProfile(account.getEmail(), request);

        assertEquals("Admin Updated", response.getFullName());
        verify(accountRepository).save(account);
        verify(customerRepository).save(argThat(c -> "0965122004".equals(c.getPhone())
                && "030204006491".equals(c.getCitizenId()) && "Hà Nội".equals(c.getAddress())));
    }

    @Test void UTC029_blankNameIsRejectedByRequestValidation() {
        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
        assertFalse(validator.validate(profile(" ", null, null, null, null, null)).isEmpty());
    }

    @Test void UTC030_shortPhoneIsRejectedByRequestValidation() {
        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
        assertFalse(validator.validate(profile("Admin", null, "09891494", null, null, null)).isEmpty());
    }

    @Test void UTC031_invalidCitizenIdIsRejectedByRequestValidation() {
        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
        assertFalse(validator.validate(profile("Admin", null, null, "12345", null, null)).isEmpty());
    }

    @Test void UTC032_nonOwnerCannotChangeAccountEmail() {
        Account account = account("worker@smartfarm.com", RoleNames.FARM_WORKER);
        when(accountRepository.findByEmail(account.getEmail())).thenReturn(Optional.of(account));
        assertThrows(AccessDeniedException.class, () -> service.updateProfile(account.getEmail(),
                profile("Worker", "new.worker@smartfarm.com", null, null, null, null)));
        verify(accountRepository, never()).save(any());
    }

    @Test void UTC033_ownerCannotChangeEmailToOneAlreadyInUse() {
        Account account = account("owner@smartfarm.com", RoleNames.FARM_OWNER); account.setId(2L);
        when(accountRepository.findByEmail(account.getEmail())).thenReturn(Optional.of(account));
        when(accountRepository.existsByEmailIgnoreCaseAndIdNot("ketoan@smartfarm.com", 2L)).thenReturn(true);
        assertThrows(ConflictException.class, () -> service.updateProfile(account.getEmail(),
                profile("Admin", "ketoan@smartfarm.com", null, null, null, null)));
    }

    @Test void UTC034_ageUnder14IsNotRejectedByPastDateConstraintAlone() {
        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
        assertTrue(validator.validate(profile("Admin", null, null, null, LocalDate.now().minusYears(13), null)).isEmpty());
    }

    @Test void UTC035_futureDateOfBirthIsRejectedByRequestValidation() {
        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
        assertFalse(validator.validate(profile("Admin", null, null, null, LocalDate.now().plusDays(1), null)).isEmpty());
    }

    // The DTO has no address-length or minimum-age constraint; these UI rules are not backend validations.
    @Test void UTC036_addressOver255CharactersIsNotRejectedByRequestDto() {
        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
        assertTrue(validator.validate(profile("Admin", null, null, null, null, "A".repeat(256))).isEmpty());
    }

    private static Account account(String email, String roleName) {
        Account a = new Account(); a.setEmail(email); a.setFullName("Existing");
        Role role = new Role(); role.setName(roleName); a.setRole(role); return a;
    }
    private static UpdateProfileRequest profile(String name, String email, String phone, String citizenId, LocalDate dob, String address) {
        UpdateProfileRequest r = new UpdateProfileRequest(); r.setFullName(name); r.setEmail(email); r.setPhone(phone);
        r.setCitizenId(citizenId); r.setDateOfBirth(dob); r.setAddress(address); return r;
    }
}
