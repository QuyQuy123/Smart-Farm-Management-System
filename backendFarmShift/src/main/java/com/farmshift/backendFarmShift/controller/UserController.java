package com.farmshift.backendFarmShift.controller;

import com.farmshift.backendFarmShift.dto.response.ApiResponse;
import com.farmshift.backendFarmShift.dto.user.ChangePasswordRequest;
import com.farmshift.backendFarmShift.dto.user.UpdateProfileRequest;
import com.farmshift.backendFarmShift.dto.user.UserProfileResponse;
import com.farmshift.backendFarmShift.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import java.security.Principal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/user")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/profile")
    public ResponseEntity<ApiResponse<UserProfileResponse>> getProfile(
            Principal principal) {
        
        UserProfileResponse profile = userService.getUserProfile(principal.getName());
        return ResponseEntity.ok(ApiResponse.success("Profile fetched successfully", profile));
    }

    @PutMapping("/profile")
    public ResponseEntity<ApiResponse<UserProfileResponse>> updateProfile(
            Principal principal,
            @Valid @RequestBody UpdateProfileRequest request) {
        
        UserProfileResponse updatedProfile = userService.updateProfile(principal.getName(), request);
        return ResponseEntity.ok(ApiResponse.success("Profile updated successfully", updatedProfile));
    }

    @PutMapping("/password")
    public ResponseEntity<ApiResponse<Void>> changePassword(
            Principal principal,
            @Valid @RequestBody ChangePasswordRequest request) {
        
        userService.changePassword(principal.getName(), request);
        return ResponseEntity.ok(ApiResponse.success("Password changed successfully"));
    }
}
