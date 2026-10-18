package com.farmshift.backendFarmShift.controller;

import com.farmshift.backendFarmShift.dto.request.*;
import com.farmshift.backendFarmShift.dto.response.ApiResponse;
import com.farmshift.backendFarmShift.dto.response.CycleDetailResponse;
import com.farmshift.backendFarmShift.dto.response.CycleSummaryResponse;
import com.farmshift.backendFarmShift.dto.response.FlockResponse;
import com.farmshift.backendFarmShift.security.RoleNames;
import com.farmshift.backendFarmShift.service.CycleRecordService;
import com.farmshift.backendFarmShift.service.CycleService;
import com.farmshift.backendFarmShift.service.FlockService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Set;

/**
 * Lứa nuôi và nhật ký của lứa. Quyền: chủ trại khai báo/kết thúc lứa, nhập đàn (chọn chương trình nuôi theo giống);
 * công nhân ghi cám và cân mẫu; kế toán ghi khoản chi. Mọi tài khoản đã đăng nhập được xem.
 */
@RestController
@RequiredArgsConstructor
public class CycleController {
    private static final Set<String> FINANCE_ROLES = Set.of(RoleNames.FARM_OWNER, RoleNames.ACCOUNTANT);
    private final CycleService service;
    private final FlockService flockService;
    private final CycleRecordService recordService;

    static boolean canSeeFinance(Authentication authentication) {
        return authentication.getAuthorities().stream().anyMatch(authority -> FINANCE_ROLES.contains(authority.getAuthority()));
    }

    @GetMapping("/api/barns/{barnId}/cycles")
    public ApiResponse<List<CycleSummaryResponse>> list(@PathVariable Long barnId) {
        return ApiResponse.success("Danh sách lứa nuôi", service.list(barnId));
    }

    @PostMapping("/api/barns/{barnId}/cycles")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<CycleSummaryResponse> start(@PathVariable Long barnId, @Valid @RequestBody StartCycleRequest request) {
        return ApiResponse.success("Đã khai báo lứa nuôi", service.start(barnId, request));
    }

    @GetMapping("/api/cycles/{id}")
    public ApiResponse<CycleDetailResponse> detail(@PathVariable Long id, Authentication authentication) {
        return ApiResponse.success("Chi tiết lứa nuôi", service.detail(id, canSeeFinance(authentication)));
    }

    @PostMapping("/api/cycles/{id}/close")
    @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<CycleSummaryResponse> close(@PathVariable Long id, @Valid @RequestBody CloseCycleRequest request) {
        return ApiResponse.success("Đã kết thúc lứa nuôi", service.close(id, request));
    }

    @PostMapping("/api/cycles/{id}/flocks")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<FlockResponse> importFlock(@PathVariable Long id, @Valid @RequestBody FlockImportRequest request, Authentication authentication) {
        return ApiResponse.success("Đã nhập đàn", flockService.importFlock(id, request, authentication.getName()));
    }

    @PostMapping("/api/cycles/{id}/feed-records")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyAuthority('ROLE_FARM_OWNER', 'ROLE_FARM_WORKER')")
    public ApiResponse<Long> addFeed(@PathVariable Long id, @Valid @RequestBody FeedRecordRequest request, Authentication authentication) {
        return ApiResponse.success("Đã ghi nhật ký cám", recordService.addFeed(id, request, authentication.getName()));
    }

    @DeleteMapping("/api/cycles/{id}/feed-records/{recordId}")
    @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<Void> deleteFeed(@PathVariable Long id, @PathVariable Long recordId) {
        recordService.deleteFeed(id, recordId);
        return ApiResponse.success("Đã xóa nhật ký cám");
    }

    @PostMapping("/api/cycles/{id}/weight-samples")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyAuthority('ROLE_FARM_OWNER', 'ROLE_FARM_WORKER')")
    public ApiResponse<Long> addWeight(@PathVariable Long id, @Valid @RequestBody WeightSampleRequest request, Authentication authentication) {
        return ApiResponse.success("Đã ghi thông số vật nuôi", recordService.addWeight(id, request, authentication.getName()));
    }

    @DeleteMapping("/api/cycles/{id}/weight-samples/{sampleId}")
    @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<Void> deleteWeight(@PathVariable Long id, @PathVariable Long sampleId) {
        recordService.deleteWeight(id, sampleId);
        return ApiResponse.success("Đã xóa thông số vật nuôi");
    }

    @PostMapping("/api/cycles/{id}/expenses")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyAuthority('ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT')")
    public ApiResponse<Long> addExpense(@PathVariable Long id, @Valid @RequestBody CycleExpenseRequest request, Authentication authentication) {
        return ApiResponse.success("Đã ghi khoản chi", recordService.addExpense(id, request, authentication.getName()));
    }

    @DeleteMapping("/api/cycles/{id}/expenses/{expenseId}")
    @PreAuthorize("hasAnyAuthority('ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT')")
    public ApiResponse<Void> deleteExpense(@PathVariable Long id, @PathVariable Long expenseId) {
        recordService.deleteExpense(id, expenseId);
        return ApiResponse.success("Đã xóa khoản chi");
    }
}
