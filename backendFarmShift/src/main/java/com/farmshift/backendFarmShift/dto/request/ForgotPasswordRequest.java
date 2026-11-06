package com.farmshift.backendFarmShift.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ForgotPasswordRequest {

    @NotBlank(message = "Email is required")
    @Email(message = "Email must be a valid email address")
    @jakarta.validation.constraints.Size(max = 100, message = "Email must not exceed 100 characters")
    @jakarta.validation.constraints.Pattern(regexp = "^\\S+$", message = "Email must not contain whitespace")
    private String email;
}
