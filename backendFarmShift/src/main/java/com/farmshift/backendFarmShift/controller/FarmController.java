package com.farmshift.backendFarmShift.controller;

import com.farmshift.backendFarmShift.dto.request.UpdateFarmRequest;
import com.farmshift.backendFarmShift.dto.response.ApiResponse;
import com.farmshift.backendFarmShift.entity.Farm;
import com.farmshift.backendFarmShift.service.FarmService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/farm")
@RequiredArgsConstructor
public class FarmController {
    private final FarmService service;

    @GetMapping
    public ApiResponse<Farm> getFarm() {
        return ApiResponse.success("Farm fetched successfully", service.getCurrentFarm());
    }

    @PutMapping
    @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<Farm> updateFarm(@Valid @RequestBody UpdateFarmRequest request) {
        return ApiResponse.success("Farm updated successfully", service.updateCurrentFarm(request));
    }
}
