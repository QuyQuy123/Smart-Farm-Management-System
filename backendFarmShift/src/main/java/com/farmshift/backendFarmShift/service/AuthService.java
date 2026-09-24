package com.farmshift.backendFarmShift.service;

import com.farmshift.backendFarmShift.dto.request.ForgotPasswordRequest;
import com.farmshift.backendFarmShift.dto.request.LoginRequest;
import com.farmshift.backendFarmShift.dto.request.ResetPasswordRequest;
import com.farmshift.backendFarmShift.dto.request.VerifyOtpRequest;
import com.farmshift.backendFarmShift.dto.response.LoginResponse;

public interface AuthService {
    LoginResponse login(LoginRequest request);
    void requestPasswordReset(ForgotPasswordRequest request);
    void verifyOtp(VerifyOtpRequest request);
    void resetPassword(ResetPasswordRequest request);
}
