package com.farmshift.backendFarmShift.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ChangePasswordRequest {
    
    @NotBlank(message = "Current password is required")
    private String currentPassword;
    
    @NotBlank(message = "New password is required")
    @Size(min = 8, max = 50, message = "New password must be between 8 and 50 characters")
    @jakarta.validation.constraints.Pattern(regexp = "^\\S+$", message = "New password must not contain whitespace")
    private String newPassword;
}
