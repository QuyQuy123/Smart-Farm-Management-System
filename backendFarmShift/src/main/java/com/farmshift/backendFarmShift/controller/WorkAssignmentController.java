package com.farmshift.backendFarmShift.controller;

import com.farmshift.backendFarmShift.dto.request.BarnWorkersRequest;
import com.farmshift.backendFarmShift.dto.request.WorkTaskCheckRequest;
import com.farmshift.backendFarmShift.dto.request.WorkTaskRequest;
import com.farmshift.backendFarmShift.dto.response.ApiResponse;
import com.farmshift.backendFarmShift.dto.response.WorkBoard;
import com.farmshift.backendFarmShift.security.RoleNames;
import com.farmshift.backendFarmShift.service.WorkAssignmentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.List;

/**
 * Phân công công việc: chủ trại chọn công nhân phụ trách chuồng và giao việc hằng ngày.
 * Công nhân được giao xác nhận / hoàn tác việc của mình.
 */
@RestController
@RequiredArgsConstructor
public class WorkAssignmentController {
    private final WorkAssignmentService service;

    @GetMapping("/api/work-assignments")
    @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<WorkBoard> board(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ApiResponse.success("Phân công công việc", service.board(date));
    }

    @PutMapping("/api/barns/{id}/workers")
    @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<List<WorkBoard.WorkerRef>> setWorkers(@PathVariable Long id, @Valid @RequestBody BarnWorkersRequest request,
                                                             Authentication authentication) {
        return ApiResponse.success("Đã cập nhật công nhân phụ trách", service.setBarnWorkers(id, request, authentication.getName()));
    }

    @PostMapping("/api/work-tasks")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<WorkBoard.AssignedTask> create(@Valid @RequestBody WorkTaskRequest request, Authentication authentication) {
        return ApiResponse.success("Đã giao việc", service.create(request, authentication.getName()));
    }

    @PutMapping("/api/work-tasks/{id}")
    @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<WorkBoard.AssignedTask> update(@PathVariable Long id, @Valid @RequestBody WorkTaskRequest request) {
        return ApiResponse.success("Đã cập nhật việc", service.update(id, request));
    }

    @DeleteMapping("/api/work-tasks/{id}")
    @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ApiResponse.success("Đã xóa việc", null);
    }

    @PostMapping("/api/work-tasks/{id}/checks")
    @PreAuthorize("hasAnyAuthority('ROLE_FARM_OWNER', 'ROLE_FARM_WORKER')")
    public ApiResponse<WorkBoard.AssignedTask> check(@PathVariable Long id, @Valid @RequestBody WorkTaskCheckRequest request,
                                                     Authentication authentication) {
        return ApiResponse.success("Đã xác nhận hoàn thành", service.check(id, request, authentication.getName(), isOwner(authentication)));
    }

    @DeleteMapping("/api/work-tasks/{id}/checks")
    @PreAuthorize("hasAnyAuthority('ROLE_FARM_OWNER', 'ROLE_FARM_WORKER')")
    public ApiResponse<WorkBoard.AssignedTask> uncheck(@PathVariable Long id, @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                                                       Authentication authentication) {
        return ApiResponse.success("Đã hoàn tác", service.uncheck(id, date, authentication.getName(), isOwner(authentication)));
    }

    private static boolean isOwner(Authentication authentication) {
        return authentication.getAuthorities().stream().anyMatch(authority -> RoleNames.FARM_OWNER.equals(authority.getAuthority()));
    }
}
