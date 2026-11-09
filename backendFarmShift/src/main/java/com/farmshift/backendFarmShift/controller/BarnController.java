package com.farmshift.backendFarmShift.controller;

import com.farmshift.backendFarmShift.dto.request.BarnRequest;
import com.farmshift.backendFarmShift.dto.response.ApiResponse;
import com.farmshift.backendFarmShift.dto.response.BarnResponse;
import com.farmshift.backendFarmShift.service.BarnService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import com.farmshift.backendFarmShift.security.RoleNames;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/barns")
@RequiredArgsConstructor
public class BarnController {
    private final BarnService service;

    @GetMapping
    public ApiResponse<List<BarnResponse>> list(@RequestParam(required = false) Long areaId, Authentication authentication) {
        String workerEmail = hasRole(authentication, RoleNames.FARM_WORKER) ? authentication.getName() : null;
        return ApiResponse.success("Danh sách chuồng", service.list(areaId, workerEmail));
    }

    @GetMapping("/{id}")
    public ApiResponse<BarnResponse> get(@PathVariable Long id, Authentication authentication) {
        String workerEmail = hasRole(authentication, RoleNames.FARM_WORKER) ? authentication.getName() : null;
        return ApiResponse.success("Chi tiết chuồng", service.get(id, workerEmail));
    }

    private static boolean hasRole(Authentication authentication, String role) {
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(a -> role.equals(a.getAuthority()));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<BarnResponse> create(@Valid @RequestBody BarnRequest request) {
        return ApiResponse.success("Đã thêm chuồng", service.create(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<BarnResponse> update(@PathVariable Long id, @Valid @RequestBody BarnRequest request) {
        return ApiResponse.success("Đã cập nhật chuồng", service.update(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ApiResponse.success("Đã xóa chuồng");
    }
}
