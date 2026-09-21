package com.farmshift.backendFarmShift.security;

import com.farmshift.backendFarmShift.entity.Account;
import com.farmshift.backendFarmShift.repository.AccountRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Spring Security's {@link UserDetailsService} implementation.
 * Loads an {@link Account} by email and maps it to Spring's {@link UserDetails}.
 */
@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    private final AccountRepository accountRepository;

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        Account account = accountRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException(
                        "No account registered with email: " + email));

        // Map the single Role to a GrantedAuthority (e.g. "ROLE_FARM_OWNER")
        String roleName = (account.getRole() != null)
                ? account.getRole().getName()
                : "ROLE_FARM_WORKER"; // safe default

        return User.builder()
                .username(account.getEmail())
                .password(account.getPassword())
                .authorities(List.of(new SimpleGrantedAuthority(roleName)))
                .accountLocked(false)
                .credentialsExpired(false)
                .disabled(!Boolean.TRUE.equals(account.getIsActive()))
                .build();
    }
}
