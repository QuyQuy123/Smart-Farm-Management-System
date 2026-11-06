package com.farmshift.backendFarmShift.controller;

import com.farmshift.backendFarmShift.dto.request.BarnWorkersRequest;
import com.farmshift.backendFarmShift.dto.request.AreaWorkerAssignmentsRequest;
import org.springframework.security.core.Authentication;
import com.farmshift.backendFarmShift.dto.response.ApiResponse;
import com.farmshift.backendFarmShift.dto.response.BarnResponsibilities;
import com.farmshift.backendFarmShift.service.BarnResponsibilityService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
public class BarnResponsibilityController {
    private final BarnResponsibilityService service;

    @GetMapping("/api/barn-responsibilities")
    public ApiResponse<BarnResponsibilities> settings() {
        return ApiResponse.success("Phân công khu nuôi và chuồng nuôi", service.settings());
    }

    @PutMapping({"/api/farm-areas/{id}/workers", "/api/areas/{id}/workers"})
    public ApiResponse<BarnResponsibilities> setArea(@PathVariable Long id, @Valid @RequestBody BarnWorkersRequest request) {
        service.setArea(id, request.workerIds());
        return ApiResponse.success("Đã cập nhật công nhân phụ trách khu nuôi", service.settings());
    }

    @DeleteMapping("/api/barns/{id}/workers/override")
    public ApiResponse<BarnResponsibilities> inherit(@PathVariable Long id) {
        service.inherit(id);
        return ApiResponse.success("Chuồng đã kế thừa công nhân từ khu nuôi", service.settings());
    }

    @PutMapping({"/api/farm-areas/{id}/worker-assignments", "/api/areas/{id}/worker-assignments"})
    public ApiResponse<BarnResponsibilities> assignArea(@PathVariable Long id,
            @Valid @RequestBody AreaWorkerAssignmentsRequest request, Authentication authentication) {
        service.assignArea(id, request, authentication.getName());
        return ApiResponse.success("Đã lưu phân công khu nuôi và các chuồng", service.settings());
    }
}
