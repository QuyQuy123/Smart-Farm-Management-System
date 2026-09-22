package com.farmshift.backendFarmShift.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UpdateProfileRequest {
    
    @NotBlank(message = "Full name is required")
    private String fullName;
    
    private String avatarUrl;
    
    @Pattern(regexp = "^\\d{10,11}$", message = "Phone number must be 10-11 digits")
    private String phone;
    
    @Pattern(regexp = "^(\\d{9}|\\d{12})$", message = "Citizen ID must be 9 or 12 digits")
    private String citizenId;
    
    private String address;
    
    @Past(message = "Date of birth must be in the past")
    @com.fasterxml.jackson.annotation.JsonFormat(pattern = "yyyy-MM-dd")
    private java.time.LocalDate dateOfBirth; 
}
