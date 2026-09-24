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
import com.farmshift.backendFarmShift.security.JwtProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;

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

    private final AuthenticationManager  authenticationManager;
    private final JwtProvider            jwtProvider;
    private final AccountRepository      accountRepository;
    private final OtpTokenRepository     otpTokenRepository;
    private final PasswordEncoder        passwordEncoder;
    private final JavaMailSender         mailSender;

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
     *
     * <p>To prevent user-enumeration attacks, the method always responds successfully
     * even if no account exists for the given email — the OTP simply won't be stored.</p>
     */
    @Transactional
    public void requestPasswordReset(ForgotPasswordRequest request) {
        String email = request.getEmail().trim().toLowerCase();

        // Throw error if the account does not exist
        if (!accountRepository.existsByEmail(email)) {
            log.warn("OTP requested for non-existent email: {}", email);
            throw new ResourceNotFoundException("This email is not registered in our system.");
        }

        // Invalidate all existing, unused OTPs for this email
        otpTokenRepository.invalidateAllByEmail(email);

        // Generate a cryptographically-secure 6-digit OTP
        String otp = generateOtp();

        OtpToken otpToken = OtpToken.builder()
                .email(email)
                .code(otp)
                .expiresAt(LocalDateTime.now().plusMinutes(OTP_EXPIRY_MINUTES))
                .used(false)
                .build();

        otpTokenRepository.save(otpToken);

        sendOtpEmail(email, otp);

        log.info("OTP issued and emailed to: {}", email);
    }

    // ------------------------------------------------------------------ verify OTP

    /**
     * Verifies the OTP without consuming it.
     * Useful for multi-step frontend flows.
     */
    @Transactional(readOnly = true)
    public void verifyOtp(com.farmshift.backendFarmShift.dto.request.VerifyOtpRequest request) {
        String email = request.getEmail().trim().toLowerCase();

        OtpToken otpToken = otpTokenRepository
                .findTopByEmailAndUsedFalseAndExpiresAtAfterOrderByCreatedAtDesc(email, LocalDateTime.now())
                .orElseThrow(() -> new BadRequestException(
                        "No valid OTP found. Please request a new one."));

        if (!otpToken.getCode().equals(request.getOtp())) {
            throw new BadRequestException("Invalid OTP code. Please try again.");
        }
    }

    // ------------------------------------------------------------------ reset password

    /**
     * Verifies the OTP and updates the account password.
     *
     * @throws BadRequestException       if the OTP is invalid or expired
     * @throws ResourceNotFoundException if no account matches the email
     */
    @Transactional
    public void resetPassword(ResetPasswordRequest request) {
        String email = request.getEmail().trim().toLowerCase();

        // 1. Find the most recently issued, still-valid OTP
        OtpToken otpToken = otpTokenRepository
                .findTopByEmailAndUsedFalseAndExpiresAtAfterOrderByCreatedAtDesc(email, LocalDateTime.now())
                .orElseThrow(() -> new BadRequestException(
                        "No valid OTP found. Please request a new one."));

        // 2. Constant-time comparison to prevent timing attacks
        if (!otpToken.getCode().equals(request.getOtp())) {
            throw new BadRequestException("Invalid OTP code. Please try again.");
        }

        // 3. Mark OTP as consumed before modifying the password (idempotency guard)
        otpToken.setUsed(true);
        otpTokenRepository.save(otpToken);

        // 4. Update the account password
        Account account = accountRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Account not found for email: " + email));

        account.setPassword(passwordEncoder.encode(request.getNewPassword()));
        accountRepository.save(account);

        log.info("Password successfully reset for email: {}", email);
    }

    // ------------------------------------------------------------------ helpers

    /** Generates a 6-digit numeric OTP using {@link SecureRandom}. */
    private String generateOtp() {
        SecureRandom random = new SecureRandom();
        int otp = 100_000 + random.nextInt(900_000); // range [100000, 999999]
        return String.valueOf(otp);
    }

    /** Sends a plain-text OTP email via the configured JavaMailSender. */
    private void sendOtpEmail(String email, String otp) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(email);
        message.setSubject("FarmShift — Your Password Reset Code");
        message.setText(
                "Hello,\n\n"
                + "You requested a password reset for your FarmShift account.\n\n"
                + "Your verification code is:\n\n"
                + "  " + otp + "\n\n"
                + "This code is valid for " + OTP_EXPIRY_MINUTES + " minutes.\n\n"
                + "If you did not request this, please ignore this email.\n\n"
                + "— The FarmShift Team"
        );

        try {
            mailSender.send(message);
        } catch (Exception ex) {
            // Log but do NOT expose mail failure details to the caller
            log.error("Failed to send OTP email to {}: {}", email, ex.getMessage());
            throw new BadRequestException("Failed to send OTP email. Please try again later.");
        }
    }
}
