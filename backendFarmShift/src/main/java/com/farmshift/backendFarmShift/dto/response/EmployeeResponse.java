package com.farmshift.backendFarmShift.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Employee view model returned by {@code /api/employees}. Never exposes the password hash.
 * Combines {@code accounts} (identity, role, status) with {@code customers} (phone, address...).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EmployeeResponse {
    private Long id;
    private String email;
    private String fullName;
    private String phone;
    private String avatarUrl;
    private Long roleId;
    private String roleName;
    private String roleDescription;
    private Boolean isActive;
    private String citizenId;
    private String address;
    private LocalDate dateOfBirth;
    private LocalDateTime createdAt;
}
