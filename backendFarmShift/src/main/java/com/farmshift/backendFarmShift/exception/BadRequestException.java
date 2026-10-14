package com.farmshift.backendFarmShift.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

/**
 * Thrown when business-rule validation fails (invalid OTP, expired OTP, inactive account, etc.).
 * Maps to HTTP 400.
 *
 * <p>An optional {@code errorCode} (e.g. {@code MSG48}) lets the frontend resolve the
 * bilingual message from SYSTEM_MESSAGES.md.</p>
 */
@Getter
@ResponseStatus(HttpStatus.BAD_REQUEST)
public class BadRequestException extends RuntimeException {

    private final String errorCode;

    public BadRequestException(String message) {
        this(message, null);
    }

    public BadRequestException(String message, String errorCode) {
        super(message);
        this.errorCode = errorCode;
    }
}
