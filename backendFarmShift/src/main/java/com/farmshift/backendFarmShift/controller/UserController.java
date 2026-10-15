package com.farmshift.backendFarmShift.controller;

import com.farmshift.backendFarmShift.dto.response.ApiResponse;
import com.farmshift.backendFarmShift.dto.request.ChangePasswordRequest;
import com.farmshift.backendFarmShift.dto.request.UpdateProfileRequest;
import com.farmshift.backendFarmShift.dto.response.UserProfileResponse;
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
    private final com.farmshift.backendFarmShift.service.FileUploadService fileUploadService;
    private final com.farmshift.backendFarmShift.security.JwtProvider jwtProvider;

    @PostMapping(value = "/avatar", consumes = org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<java.util.Map<String, String>>> uploadAvatar(
            Principal principal, @RequestParam("file") org.springframework.web.multipart.MultipartFile file) {
        String url = fileUploadService.uploadFile(file, "avatars");
        userService.updateAvatar(principal.getName(), url);
        return ResponseEntity.ok(ApiResponse.success("Avatar updated successfully", java.util.Map.of("url", url)));
    }

    @GetMapping("/profile")
    public ResponseEntity<ApiResponse<UserProfileResponse>> getProfile(
            Principal principal) {
        
        UserProfileResponse profile = userService.getUserProfile(principal.getName());
        return ResponseEntity.ok(ApiResponse.success("Profile fetched successfully", profile));
    }

    @GetMapping("/all")
    public ResponseEntity<ApiResponse<java.util.List<UserProfileResponse>>> getAllUsers() {
        java.util.List<UserProfileResponse> users = userService.getAllUsers();
        return ResponseEntity.ok(ApiResponse.success("Users fetched successfully", users));
    }

    @PutMapping("/profile")
    public ResponseEntity<ApiResponse<UserProfileResponse>> updateProfile(
            Principal principal,
            @Valid @RequestBody UpdateProfileRequest request) {
        
        UserProfileResponse updatedProfile = userService.updateProfile(principal.getName(), request);
        if (!principal.getName().equals(updatedProfile.getEmail())) {
            var authentication = new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                    updatedProfile.getEmail(), null,
                    java.util.List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority(updatedProfile.getRole())));
            updatedProfile.setToken(jwtProvider.generateToken(authentication));
        }
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
