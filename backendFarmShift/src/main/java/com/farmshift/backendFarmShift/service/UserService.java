package com.farmshift.backendFarmShift.service;

import com.farmshift.backendFarmShift.dto.user.ChangePasswordRequest;
import com.farmshift.backendFarmShift.dto.user.UpdateProfileRequest;
import com.farmshift.backendFarmShift.dto.user.UserProfileResponse;
import com.farmshift.backendFarmShift.entity.Account;
import com.farmshift.backendFarmShift.exception.BadRequestException;
import com.farmshift.backendFarmShift.exception.ResourceNotFoundException;
import com.farmshift.backendFarmShift.repository.AccountRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserService {

    private final AccountRepository accountRepository;
    private final PasswordEncoder passwordEncoder;

    public UserProfileResponse getUserProfile(String email) {
        Account account = getAccountByEmail(email);
        return mapToResponse(account);
    }

    @Transactional
    public UserProfileResponse updateProfile(String email, UpdateProfileRequest request) {
        Account account = getAccountByEmail(email);
        
        account.setFullName(request.getFullName().trim());
        if (request.getAvatarUrl() != null) {
            account.setAvatarUrl(request.getAvatarUrl().trim());
        }

        account = accountRepository.save(account);
        log.info("Profile updated for user: {}", email);
        
        return mapToResponse(account);
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

    private UserProfileResponse mapToResponse(Account account) {
        String roleName = (account.getRole() != null) ? account.getRole().getName() : "";
        return UserProfileResponse.builder()
                .email(account.getEmail())
                .role(roleName)
                .fullName(account.getFullName())
                .avatarUrl(account.getAvatarUrl())
                .build();
    }
}
