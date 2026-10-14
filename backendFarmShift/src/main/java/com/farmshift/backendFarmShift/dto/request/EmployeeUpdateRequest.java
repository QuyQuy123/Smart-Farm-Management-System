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
 * Payload for {@code PUT /api/employees/{id}}.
 *
 * <p>{@code roleName} and {@code isActive} are optional: {@code null} means "keep current value".
 * The password is intentionally not editable here — employees change it themselves.</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EmployeeUpdateRequest {

    @NotBlank(message = "Full name is required")
    @Size(max = 100, message = "Full name must not exceed 100 characters")
    private String fullName;

    @NotBlank(message = "Email is required")
    @Email(message = "Email format is invalid")
    @Size(max = 50, message = "Email must not exceed 50 characters")
    private String email;

    @Pattern(regexp = "^(\\d{10,11})?$", message = "Phone number must be 10-11 digits")
    private String phone;

    private String avatarUrl;

    private String roleName;

    private Boolean isActive;
}
