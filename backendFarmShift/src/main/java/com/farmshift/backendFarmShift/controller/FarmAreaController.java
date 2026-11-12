package com.farmshift.backendFarmShift.controller;

import com.farmshift.backendFarmShift.dto.request.FarmAreaRequest;
import com.farmshift.backendFarmShift.dto.response.ApiResponse;
import com.farmshift.backendFarmShift.dto.response.FarmAreaResponse;
import com.farmshift.backendFarmShift.service.FarmAreaService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import com.farmshift.backendFarmShift.security.RoleNames;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping({"/api/farm-areas", "/api/areas"})
@RequiredArgsConstructor
public class FarmAreaController {
    private final FarmAreaService service;

    @GetMapping
    public ApiResponse<List<FarmAreaResponse>> list(Authentication authentication) {
        String workerEmail = hasRole(authentication, RoleNames.FARM_WORKER) ? authentication.getName() : null;
        return ApiResponse.success("Danh sách khu nuôi", service.list(workerEmail));
    }

    @GetMapping("/{id}")
    public ApiResponse<FarmAreaResponse> get(@PathVariable Long id, Authentication authentication) {
        String workerEmail = hasRole(authentication, RoleNames.FARM_WORKER) ? authentication.getName() : null;
        return ApiResponse.success("Chi tiết khu nuôi", service.get(id, workerEmail));
    }

    private static boolean hasRole(Authentication authentication, String role) {
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(a -> role.equals(a.getAuthority()));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<FarmAreaResponse> create(@Valid @RequestBody FarmAreaRequest request) {
        return ApiResponse.success("Đã thêm khu nuôi", service.create(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<FarmAreaResponse> update(@PathVariable Long id, @Valid @RequestBody FarmAreaRequest request) {
        return ApiResponse.success("Đã cập nhật khu nuôi", service.update(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ApiResponse.success("Đã xóa khu nuôi");
    }
}
