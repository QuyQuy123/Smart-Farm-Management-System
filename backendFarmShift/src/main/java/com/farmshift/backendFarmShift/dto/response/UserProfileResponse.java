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
    @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL)
    private String token;
    private String email;
    private String role;
    private String fullName;
    private String avatarUrl;
    private String phone;
    private String citizenId;
    private String address;
    private String dateOfBirth;
}
