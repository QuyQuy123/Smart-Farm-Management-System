package com.farmshift.backendFarmShift.service;

import com.farmshift.backendFarmShift.dto.request.ChangePasswordRequest;
import com.farmshift.backendFarmShift.dto.request.UpdateProfileRequest;
import com.farmshift.backendFarmShift.dto.response.UserProfileResponse;
import com.farmshift.backendFarmShift.entity.Account;
import com.farmshift.backendFarmShift.entity.Customer;
import com.farmshift.backendFarmShift.exception.BadRequestException;
import com.farmshift.backendFarmShift.exception.ResourceNotFoundException;
import com.farmshift.backendFarmShift.repository.AccountRepository;
import com.farmshift.backendFarmShift.repository.CustomerRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserService {

    private final AccountRepository accountRepository;
    private final CustomerRepository customerRepository;
    private final PasswordEncoder passwordEncoder;

    public UserProfileResponse getUserProfile(String email) {
        Account account = getAccountByEmail(email);
        Optional<Customer> customerOpt = customerRepository.findByAccount(account);
        return mapToResponse(account, customerOpt.orElse(null));
    }

    @Transactional
    public UserProfileResponse updateProfile(String email, UpdateProfileRequest request) {
        Account account = getAccountByEmail(email);
        
        account.setFullName(request.getFullName().trim());
        if (request.getAvatarUrl() != null) {
            account.setAvatarUrl(request.getAvatarUrl().trim());
        }

        account = accountRepository.save(account);

        Customer customer = customerRepository.findByAccount(account).orElse(new Customer());
        customer.setAccount(account);
        customer.setFullName(account.getFullName());
        customer.setAvatarUrl(account.getAvatarUrl());
        
        if (request.getPhone() != null) customer.setPhone(request.getPhone().trim());
        if (request.getCitizenId() != null) customer.setCitizenId(request.getCitizenId().trim());
        if (request.getAddress() != null) customer.setAddress(request.getAddress().trim());
        
        if (request.getDateOfBirth() != null) {
            customer.setDateOfBirth(request.getDateOfBirth());
        }

        customerRepository.save(customer);

        log.info("Profile updated for user: {}", email);
        
        return mapToResponse(account, customer);
    }

    @Transactional
    public void changePassword(String email, ChangePasswordRequest request) {
        Account account = getAccountByEmail(email);
        
        // Verify current password
        if (!passwordEncoder.matches(request.getCurrentPassword(), account.getPassword())) {
            log.warn("Failed password change attempt for user: {}", email);
            throw new BadRequestException("Incorrect current password.");
        }
        
        account.setPassword(passwordEncoder.encode(request.getNewPassword()));
        accountRepository.save(account);
        log.info("Password changed successfully for user: {}", email);
    }

    private Account getAccountByEmail(String email) {
        return accountRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Account not found for email: " + email));
    }

    private UserProfileResponse mapToResponse(Account account, Customer customer) {
        String roleName = (account.getRole() != null) ? account.getRole().getName() : "";
        
        UserProfileResponse response = UserProfileResponse.builder()
                .email(account.getEmail())
                .role(roleName)
                .fullName(account.getFullName())
                .avatarUrl(account.getAvatarUrl())
                .build();
                
        if (customer != null) {
            response.setPhone(customer.getPhone());
            response.setCitizenId(customer.getCitizenId());
            response.setAddress(customer.getAddress());
            response.setDateOfBirth(customer.getDateOfBirth() != null ? customer.getDateOfBirth().toString() : null);
        }
        
        return response;
    }
}
