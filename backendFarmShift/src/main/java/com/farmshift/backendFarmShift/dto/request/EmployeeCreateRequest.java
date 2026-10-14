package com.farmshift.backendFarmShift.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Payload for {@code POST /api/employees}. Only the Farm Owner may call it.
 * The role must be ROLE_ACCOUNTANT or ROLE_FARM_WORKER (enforced in the service — MSG48).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EmployeeCreateRequest {

    @NotBlank(message = "Full name is required")
    @Size(max = 100, message = "Full name must not exceed 100 characters")
    private String fullName;

    @NotBlank(message = "Email is required")
    @Email(message = "Email format is invalid")
    @Size(max = 50, message = "Email must not exceed 50 characters")
    private String email;

    /** Optional. Empty string is accepted and stored as null. */
    @Pattern(regexp = "^(\\d{10,11})?$", message = "Phone number must be 10-11 digits")
    private String phone;

    /** Initial password; if left blank or null, defaults to '123456'. Must be between 6 and 72 characters if provided. */
    @Pattern(regexp = "^$|^.{6,72}$", message = "Password must be at least 6 characters")
    private String password;

    private String avatarUrl;

    @NotBlank(message = "Role is required")
    private String roleName;
}
