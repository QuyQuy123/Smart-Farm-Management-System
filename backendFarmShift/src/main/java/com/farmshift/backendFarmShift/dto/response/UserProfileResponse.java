package com.farmshift.backendFarmShift.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserProfileResponse {
    private String email;
    private String role;
    private String fullName;
    private String avatarUrl;
    private String phone;
    private String citizenId;
    private String address;
    private String dateOfBirth;
}
