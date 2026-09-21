package com.farmshift.backendFarmShift.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Stores short-lived OTP codes for the Forgot Password flow.
 * One active token per email at a time (enforced in service).
 */
@Entity
@Table(name = "otp_tokens")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OtpToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * The email address this OTP was sent to.
     * Not a FK — an OTP can be sent before the account look-up phase to avoid user enumeration leaks.
     */
    @Column(nullable = false, length = 100)
    private String email;

    /** 6-digit numeric code (stored in plain-text — short-lived, low entropy by design). */
    @Column(nullable = false, length = 6)
    private String code;

    /** When this OTP expires (5 minutes from creation). */
    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    /** Set to true after the OTP has been consumed by /reset-password. */
    @Builder.Default
    @Column(name = "is_used", nullable = false)
    private boolean used = false;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
