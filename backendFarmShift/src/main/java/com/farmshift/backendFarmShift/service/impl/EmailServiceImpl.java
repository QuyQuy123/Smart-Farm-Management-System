package com.farmshift.backendFarmShift.service.impl;

import com.farmshift.backendFarmShift.service.EmailService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

/**
 * Production-ready email service supporting Resend HTTP API (HTTPS port 443)
 * and JavaMailSender (SMTP), with fallback logging for restricted environments (e.g. Render Free tier).
 */
@Slf4j
@Service
public class EmailServiceImpl implements EmailService {

    private final ObjectProvider<JavaMailSender> mailSenderProvider;
    private final RestClient restClient;

    @Value("${resend.api-key:}")
    private String resendApiKey;

    @Value("${resend.from-email:FarmShift <onboarding@resend.dev>}")
    private String resendFromEmail;

    public EmailServiceImpl(ObjectProvider<JavaMailSender> mailSenderProvider) {
        this.mailSenderProvider = mailSenderProvider;
        this.restClient = RestClient.builder().build();
    }

    @Async
    @Override
    public void sendOtpEmail(String toEmail, String otp) {
        log.info("================================================================================");
        log.info("🔑 [FarmShift OTP] For: {} | Code: [{}] (Valid for 5 minutes)", toEmail, otp);
        log.info("================================================================================");

        // 1. Prioritize Resend HTTP API (HTTPS port 443 — works seamlessly on Render Free & Cloud)
        if (resendApiKey != null && !resendApiKey.isBlank()) {
            try {
                sendViaResend(toEmail, otp);
                log.info("✅ Successfully delivered OTP email to {} via Resend HTTP API.", toEmail);
                return;
            } catch (Exception ex) {
                log.error("❌ Resend API failed to deliver email to {}: {}", toEmail, ex.getMessage());
            }
        }

        // 2. Fallback to JavaMailSender (SMTP)
        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
        if (mailSender != null) {
            try {
                SimpleMailMessage message = new SimpleMailMessage();
                message.setTo(toEmail);
                message.setSubject("FarmShift — Mã xác thực đặt lại mật khẩu");
                message.setText(
                        "Xin chào,\n\n"
                        + "Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản FarmShift.\n\n"
                        + "Mã xác thực của bạn là:\n\n"
                        + "  " + otp + "\n\n"
                        + "Mã này có hiệu lực trong 5 phút.\n\n"
                        + "Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.\n\n"
                        + "— The FarmShift Team"
                );
                mailSender.send(message);
                log.info("✅ Successfully sent OTP email to {} via SMTP.", toEmail);
                return;
            } catch (Exception ex) {
                log.warn("⚠️ SMTP failed to deliver to {}: {}. Note: Render Free tier blocks outbound SMTP ports 25, 465, 587. The OTP [{}] is saved and available in server logs.", toEmail, ex.getMessage(), otp);
            }
        } else {
            log.warn("⚠️ No SMTP or Resend credentials configured. The OTP [{}] for {} is logged in server console.", otp, toEmail);
        }
    }

    private void sendViaResend(String toEmail, String otp) {
        Map<String, Object> payload = Map.of(
                "from", resendFromEmail,
                "to", List.of(toEmail),
                "subject", "FarmShift — Mã xác thực đặt lại mật khẩu",
                "html", "<div style=\"font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; color: #1e293b;\">"
                        + "<h2 style=\"color: #16a34a; margin-top: 0;\">FarmShift Management</h2>"
                        + "<p>Xin chào,</p>"
                        + "<p>Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản FarmShift. Mã xác thực (OTP) của bạn là:</p>"
                        + "<div style=\"background: #f0fdf4; border: 1px dashed #22c55e; border-radius: 8px; padding: 18px; text-align: center; margin: 24px 0;\">"
                        + "<span style=\"font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #15803d;\">" + otp + "</span>"
                        + "</div>"
                        + "<p style=\"color: #64748b; font-size: 13px; line-height: 1.5;\">Mã xác thực có hiệu lực trong 5 phút. Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.</p>"
                        + "<hr style=\"border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;\" />"
                        + "<p style=\"color: #94a3b8; font-size: 12px; margin: 0;\">© 2026 FarmShift Management. Tất cả các quyền được bảo lưu.</p>"
                        + "</div>"
        );

        restClient.post()
                .uri("https://api.resend.com/emails")
                .header("Authorization", "Bearer " + resendApiKey.trim())
                .contentType(MediaType.APPLICATION_JSON)
                .body(payload)
                .retrieve()
                .toBodilessEntity();
    }
}
