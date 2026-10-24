package com.farmshift.backendFarmShift.service;

/**
 * Service for delivering transactional emails such as OTP verification codes.
 */
public interface EmailService {

    /**
     * Sends a 6-digit OTP code to the recipient's email address.
     * Implementations should handle delivery asynchronously and gracefully
     * recover / log if outbound transport (SMTP/HTTP) is constrained.
     *
     * @param toEmail destination email address
     * @param otp     6-digit verification code
     */
    void sendOtpEmail(String toEmail, String otp);
}
