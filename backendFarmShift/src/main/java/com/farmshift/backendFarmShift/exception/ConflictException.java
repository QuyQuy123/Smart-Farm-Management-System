package com.farmshift.backendFarmShift.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

/**
 * Thrown when a request conflicts with existing data (e.g. duplicate email — MSG47).
 * Maps to HTTP 409.
 */
@Getter
@ResponseStatus(HttpStatus.CONFLICT)
public class ConflictException extends RuntimeException {

    private final String errorCode;
    private final String field;

    public ConflictException(String message, String errorCode, String field) {
        super(message);
        this.errorCode = errorCode;
        this.field = field;
    }
}
