package com.farmshift.backendFarmShift.service;

import com.farmshift.backendFarmShift.dto.request.ChangePasswordRequest;
import com.farmshift.backendFarmShift.dto.request.UpdateProfileRequest;
import com.farmshift.backendFarmShift.dto.response.UserProfileResponse;

public interface UserService {
    UserProfileResponse getUserProfile(String email);
    UserProfileResponse updateProfile(String email, UpdateProfileRequest request);
    void changePassword(String email, ChangePasswordRequest request);
}
