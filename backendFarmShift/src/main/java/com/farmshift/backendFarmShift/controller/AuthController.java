package com.farmshift.backendFarmShift.controller;

import com.farmshift.backendFarmShift.dto.request.ForgotPasswordRequest;
import com.farmshift.backendFarmShift.dto.request.LoginRequest;
import com.farmshift.backendFarmShift.dto.request.ResetPasswordRequest;
import com.farmshift.backendFarmShift.dto.response.ApiResponse;
import com.farmshift.backendFarmShift.dto.response.LoginResponse;
import com.farmshift.backendFarmShift.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Authentication endpoints — all publicly accessible (no JWT required).
 *
 * <pre>
 * POST /api/auth/login            — Returns JWT + role
 * POST /api/auth/forgot-password  — Sends 6-digit OTP to email
 * POST /api/auth/reset-password   — Verifies OTP, updates password
 * </pre>
 */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    /**
     * Authenticates a user with email + password.
     *
     * @param request validated login credentials
     * @return 200 with {@link LoginResponse} containing JWT, tokenType, email, and role
     */
    @PostMapping("/login")
    public ResponseEntity<ApiResponse<LoginResponse>> login(
            @Valid @RequestBody LoginRequest request) {

        LoginResponse response = authService.login(request);
        return ResponseEntity.ok(
                ApiResponse.success("Login successful", response));
    }

    /**
     * Initiates the forgot-password flow by sending a 6-digit OTP to the registered email.
     *
     * <p>Always returns 200 even if the email is not registered (anti-enumeration).</p>
     *
     * @param request validated email address
     * @return 200 with a generic success message
     */
    @PostMapping("/forgot-password")
    public ResponseEntity<ApiResponse<Void>> forgotPassword(
            @Valid @RequestBody ForgotPasswordRequest request) {

        authService.requestPasswordReset(request);
        return ResponseEntity.ok(
                ApiResponse.success("If an account exists for that email, you will receive an OTP shortly."));
    }

    /**
     * Verifies if an OTP is valid without consuming it.
     *
     * @param request email + OTP
     * @return 200 on success, 400 if invalid
     */
    @PostMapping("/verify-otp")
    public ResponseEntity<ApiResponse<Void>> verifyOtp(
            @Valid @RequestBody com.farmshift.backendFarmShift.dto.request.VerifyOtpRequest request) {

        authService.verifyOtp(request);
        return ResponseEntity.ok(
                ApiResponse.success("OTP verified successfully."));
    }

    /**
     * Verifies the OTP and updates the account password.
     *
     * @param request email + OTP + new-password
     * @return 200 on success, 400 if OTP is invalid or expired
     */
    @PostMapping("/reset-password")
    public ResponseEntity<ApiResponse<Void>> resetPassword(
            @Valid @RequestBody ResetPasswordRequest request) {

        authService.resetPassword(request);
        return ResponseEntity.ok(
                ApiResponse.success("Password has been reset successfully. Please log in with your new password."));
    }
}
