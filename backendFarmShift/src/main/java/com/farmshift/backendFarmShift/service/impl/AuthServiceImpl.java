package com.farmshift.backendFarmShift.service.impl;

import com.farmshift.backendFarmShift.service.AuthService;

import com.farmshift.backendFarmShift.dto.request.ForgotPasswordRequest;
import com.farmshift.backendFarmShift.dto.request.LoginRequest;
import com.farmshift.backendFarmShift.dto.request.ResetPasswordRequest;
import com.farmshift.backendFarmShift.dto.response.LoginResponse;
import com.farmshift.backendFarmShift.entity.Account;
import com.farmshift.backendFarmShift.entity.OtpToken;
import com.farmshift.backendFarmShift.exception.BadRequestException;
import com.farmshift.backendFarmShift.exception.ResourceNotFoundException;
import com.farmshift.backendFarmShift.repository.AccountRepository;
import com.farmshift.backendFarmShift.repository.OtpTokenRepository;
import com.farmshift.backendFarmShift.security.AccountAuthStateService;
import com.farmshift.backendFarmShift.security.JwtProvider;
import com.farmshift.backendFarmShift.service.CycleService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import com.farmshift.backendFarmShift.service.EmailService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Core authentication service.
 *
 * <h3>Login flow</h3>
 * <ol>
 *   <li>Delegate credential verification to Spring Security's {@link AuthenticationManager}
 *       (which internally calls {@code CustomUserDetailsService} + BCrypt comparison).</li>
 *   <li>On success, generate a JWT via {@link JwtProvider} and return it with the role.</li>
 * </ol>
 *
 * <h3>Forgot-password flow</h3>
 * <ol>
 *   <li>Invalidate any active OTPs for the email (prevent multi-token abuse).</li>
 *   <li>Generate a new cryptographically-random 6-digit OTP, persisted with a 5-minute TTL.</li>
 *   <li>Send the OTP to the user's email address via {@link JavaMailSender}.</li>
 * </ol>
 *
 * <h3>Reset-password flow</h3>
 * <ol>
 *   <li>Look up the most recent valid (unused, non-expired) OTP for the email.</li>
 *   <li>Verify the submitted code matches.</li>
 *   <li>Mark the OTP as used, BCrypt-hash the new password, persist to the account.</li>
 * </ol>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private static final int OTP_EXPIRY_MINUTES = 5;
    private static final int MAX_OTP_ATTEMPTS = 5;
    private static final int MAX_ATTEMPT_BUCKETS = 5_000;

    private final AuthenticationManager  authenticationManager;
    private final JwtProvider            jwtProvider;
    private final AccountRepository      accountRepository;
    private final OtpTokenRepository     otpTokenRepository;
    private final PasswordEncoder        passwordEncoder;
    private final EmailService           emailService;
    private final ConcurrentHashMap<String, AtomicInteger> otpFailedAttempts = new ConcurrentHashMap<>();

    @Autowired(required = false)
    private AccountAuthStateService accountAuthStateService;

    // ------------------------------------------------------------------ login

    /**
     * Authenticates the user and returns a JWT + role.
     *
     * @throws org.springframework.security.authentication.BadCredentialsException if credentials are wrong
     * @throws org.springframework.security.authentication.DisabledException       if the account is inactive
     */
    public LoginResponse login(LoginRequest request) {
        // AuthenticationManager will throw BadCredentialsException or DisabledException automatically
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        request.getEmail().trim().toLowerCase(),
                        request.getPassword()
                ));

        String token = jwtProvider.generateToken(authentication);

        // Retrieve the role from the DB to include the human-readable name in the response
        Account account = accountRepository.findByEmail(request.getEmail().trim().toLowerCase())
                .orElseThrow(() -> new ResourceNotFoundException("Account not found"));

        String roleName = account.getRole() != null ? account.getRole().getName() : "ROLE_FARM_WORKER";

        log.info("Successful login for email: {}", account.getEmail());

        return LoginResponse.builder()
                .accessToken(token)
                .email(account.getEmail())
                .role(roleName)
                .build();
    }

    // ------------------------------------------------------------------ forgot password

    /**
     * Generates and emails a 6-digit OTP for password recovery.
     * Validates that the account exists and is active before issuing an OTP.
     */
    @Transactional
    public void requestPasswordReset(ForgotPasswordRequest request) {
        String email = request.getEmail().trim().toLowerCase();

        // Throw error if the account does not exist
        if (!accountRepository.existsByEmail(email)) {
            log.warn("OTP requested for non-existent email: {}", email);
            throw new ResourceNotFoundException("This email is not registered in our system.");
        }

        Account account = accountRepository.findByEmail(email).orElse(null);
        if (account != null && Boolean.FALSE.equals(account.getIsActive())) {
            throw new BadRequestException("Tài khoản đang bị vô hiệu hóa.");
        }

        // Invalidate all existing, unused OTPs for this email
        otpTokenRepository.invalidateAllByEmail(email);
        otpFailedAttempts.remove(email);

        // Generate a cryptographically-secure 6-digit OTP
        String otp = generateOtp();

        OtpToken otpToken = OtpToken.builder()
                .email(email)
                .code(otp)
                .expiresAt(LocalDateTime.now(CycleService.VN_ZONE).plusMinutes(OTP_EXPIRY_MINUTES))
                .used(false)
                .build();

        otpTokenRepository.save(otpToken);

        emailService.sendOtpEmail(email, otp);

        log.info("OTP issued and sent for email: {}", email);
    }

    // ------------------------------------------------------------------ verify OTP

    /**
     * Verifies the OTP without consuming it (invalidating on excessive failed attempts).
     * Useful for multi-step frontend flows.
     */
    @Transactional(noRollbackFor = BadRequestException.class)
    public void verifyOtp(com.farmshift.backendFarmShift.dto.request.VerifyOtpRequest request) {
        String email = request.getEmail().trim().toLowerCase();

        OtpToken otpToken = otpTokenRepository
                .findTopByEmailAndUsedFalseAndExpiresAtAfterOrderByCreatedAtDesc(email, LocalDateTime.now(CycleService.VN_ZONE))
                .orElseThrow(() -> new BadRequestException(
                        "No valid OTP found. Please request a new one."));

        if (!constantTimeEquals(otpToken.getCode(), request.getOtp())) {
            recordFailedOtpAttempt(email, otpToken);
            throw new BadRequestException("Invalid OTP code. Please try again.");
        }

        Account account = accountRepository.findByEmail(email).orElse(null);
        if (account != null && Boolean.FALSE.equals(account.getIsActive())) {
            throw new BadRequestException("Tài khoản đang bị vô hiệu hóa.");
        }
    }

    // ------------------------------------------------------------------ reset password

    /**
     * Verifies the OTP and updates the account password.
     *
     * @throws BadRequestException       if the OTP is invalid/expired or the account is inactive
     * @throws ResourceNotFoundException if no account matches the email
     */
    @Transactional(noRollbackFor = BadRequestException.class)
    public void resetPassword(ResetPasswordRequest request) {
        String email = request.getEmail().trim().toLowerCase();

        // 1. Find the most recently issued, still-valid OTP
        OtpToken otpToken = otpTokenRepository
                .findTopByEmailAndUsedFalseAndExpiresAtAfterOrderByCreatedAtDesc(email, LocalDateTime.now(CycleService.VN_ZONE))
                .orElseThrow(() -> new BadRequestException(
                        "No valid OTP found. Please request a new one."));

        // 2. Constant-time comparison to prevent timing attacks + brute-force lockout
        if (!constantTimeEquals(otpToken.getCode(), request.getOtp())) {
            recordFailedOtpAttempt(email, otpToken);
            throw new BadRequestException("Invalid OTP code. Please try again.");
        }

        // 3. Load account and verify it is active before consuming OTP
        if (request.getNewPassword() != null && request.getNewPassword().chars().anyMatch(Character::isWhitespace)) {
            throw new BadRequestException("Password must not contain whitespace.");
        }
        Account account = accountRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Account not found for email: " + email));
        if (Boolean.FALSE.equals(account.getIsActive())) {
            throw new BadRequestException("Tài khoản đang bị vô hiệu hóa.");
        }

        // 4. Mark OTP as consumed before modifying the password (idempotency guard)
        otpFailedAttempts.remove(email);
        otpToken.setUsed(true);
        otpTokenRepository.save(otpToken);

        account.setPassword(passwordEncoder.encode(request.getNewPassword()));
        accountRepository.save(account);
        if (accountAuthStateService != null) {
            accountAuthStateService.evictAndRevokeTokensIssuedBeforeNow(email);
        }

        log.info("Password successfully reset for email: {}", email);
    }

    // ------------------------------------------------------------------ helpers

    private void recordFailedOtpAttempt(String email, OtpToken otpToken) {
        if (otpFailedAttempts.size() >= MAX_ATTEMPT_BUCKETS) {
            otpFailedAttempts.clear();
        }
        int attempts = otpFailedAttempts.computeIfAbsent(email, ignored -> new AtomicInteger()).incrementAndGet();
        if (attempts >= MAX_OTP_ATTEMPTS) {
            otpToken.setUsed(true);
            otpTokenRepository.save(otpToken);
            otpFailedAttempts.remove(email);
        }
    }

    private static boolean constantTimeEquals(String expected, String provided) {
        if (expected == null || provided == null) {
            return false;
        }
        return MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.UTF_8),
                provided.getBytes(StandardCharsets.UTF_8)
        );
    }

    /** Generates a 6-digit numeric OTP using {@link SecureRandom}. */
    private String generateOtp() {
        SecureRandom random = new SecureRandom();
        int otp = 100_000 + random.nextInt(900_000); // range [100000, 999999]
        return String.valueOf(otp);
    }
}
