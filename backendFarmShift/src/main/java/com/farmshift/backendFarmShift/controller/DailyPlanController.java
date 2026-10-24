package com.farmshift.backendFarmShift.controller;

import com.farmshift.backendFarmShift.dto.request.DailyTaskConfirmRequest;
import com.farmshift.backendFarmShift.dto.response.ApiResponse;
import com.farmshift.backendFarmShift.dto.response.BarnDayPlan;
import com.farmshift.backendFarmShift.security.RoleNames;
import com.farmshift.backendFarmShift.service.DailyPlanService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.List;

/**
 * Phiếu việc hằng ngày theo chương trình nuôi. Mọi tài khoản xem được; chủ trại và công nhân xác nhận / hoàn tác.
 * Tiền chỉ trả về cho chủ trại và kế toán.
 */
@RestController
@RequiredArgsConstructor
public class DailyPlanController {
    private final DailyPlanService service;

    @GetMapping("/api/daily-plan")
    public ApiResponse<List<BarnDayPlan>> farm(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                                               Authentication authentication) {
        return ApiResponse.success("Phiếu việc trong ngày", service.farm(date, canSeeFinance(authentication)));
    }

    @GetMapping("/api/cycles/{id}/daily-plan")
    public ApiResponse<BarnDayPlan> barn(@PathVariable Long id, @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                                         Authentication authentication) {
        return ApiResponse.success("Phiếu việc của chuồng", service.barn(id, date, canSeeFinance(authentication)));
    }

    @PostMapping("/api/cycles/{id}/daily-plan/tasks")
    @PreAuthorize("hasAnyAuthority('ROLE_FARM_OWNER', 'ROLE_FARM_WORKER')")
    public ApiResponse<BarnDayPlan> confirm(@PathVariable Long id, @Valid @RequestBody DailyTaskConfirmRequest request, Authentication authentication) {
        return ApiResponse.success("Đã xác nhận hoàn thành", service.confirm(id, request, authentication.getName(), canSeeFinance(authentication)));
    }

    @DeleteMapping("/api/cycles/{id}/daily-plan/tasks")
    @PreAuthorize("hasAnyAuthority('ROLE_FARM_OWNER', 'ROLE_FARM_WORKER')")
    public ApiResponse<BarnDayPlan> undo(@PathVariable Long id, @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                                         @RequestParam String taskKey, Authentication authentication) {
        boolean owner = hasRole(authentication, RoleNames.FARM_OWNER);
        return ApiResponse.success("Đã hoàn tác", service.undo(id, date, taskKey, authentication.getName(), owner, canSeeFinance(authentication)));
    }

    private static boolean canSeeFinance(Authentication authentication) {
        return CycleController.canSeeFinance(authentication);
    }

    private static boolean hasRole(Authentication authentication, String role) {
        return authentication.getAuthorities().stream().anyMatch(authority -> role.equals(authority.getAuthority()));
    }
}
