package com.farmshift.backendFarmShift.controller;

import com.farmshift.backendFarmShift.dto.request.FlockHarvestRequest;
import com.farmshift.backendFarmShift.dto.request.FlockLossRequest;
import com.farmshift.backendFarmShift.dto.request.FlockTransferRequest;
import com.farmshift.backendFarmShift.dto.response.ApiResponse;
import com.farmshift.backendFarmShift.dto.response.FlockMovementResponse;
import com.farmshift.backendFarmShift.dto.response.FlockResponse;
import com.farmshift.backendFarmShift.service.FlockService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/** Biến động đàn: chuyển đàn (chủ trại), hao hụt / loại thải (chủ trại, công nhân), xuất bán (chủ trại, kế toán). */
@RestController
@RequestMapping("/api/flocks")
@RequiredArgsConstructor
public class FlockController {
    private final FlockService service;

    @PostMapping("/{id}/transfer")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<FlockResponse> transfer(@PathVariable Long id, @Valid @RequestBody FlockTransferRequest request, Authentication authentication) {
        return ApiResponse.success("Đã chuyển đàn", service.transfer(id, request, authentication.getName()));
    }

    @PostMapping("/{id}/losses")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyAuthority('ROLE_FARM_OWNER', 'ROLE_FARM_WORKER')")
    public ApiResponse<FlockMovementResponse> recordLoss(@PathVariable Long id, @Valid @RequestBody FlockLossRequest request, Authentication authentication) {
        return ApiResponse.success("Đã ghi hao hụt", service.recordLoss(id, request, authentication.getName()));
    }

    @PostMapping("/{id}/harvests")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyAuthority('ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT')")
    public ApiResponse<FlockMovementResponse> harvest(@PathVariable Long id, @Valid @RequestBody FlockHarvestRequest request, Authentication authentication) {
        return ApiResponse.success("Đã ghi xuất bán", service.harvest(id, request, authentication.getName()));
    }
}
