package com.farmshift.backendFarmShift.controller;

import com.farmshift.backendFarmShift.dto.response.ApiResponse;
import com.farmshift.backendFarmShift.dto.response.DashboardResponse;
import com.farmshift.backendFarmShift.security.RoleNames;
import com.farmshift.backendFarmShift.service.DashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalTime;

/** Bảng tin: chủ trại và kế toán xem toàn trại (kế toán thấy tiền), công nhân chỉ xem chuồng mình phụ trách, không có tiền. */
@RestController
@RequiredArgsConstructor
public class DashboardController {
    private final DashboardService service;

    @GetMapping("/api/dashboard")
    public ApiResponse<DashboardResponse> get(Authentication authentication) {
        boolean worker = authentication.getAuthorities().stream().anyMatch(authority -> RoleNames.FARM_WORKER.equals(authority.getAuthority()));
        return ApiResponse.success("Bảng tin", service.get(CycleController.canSeeFinance(authentication), worker ? authentication.getName() : null, LocalTime.now()));
    }
}
