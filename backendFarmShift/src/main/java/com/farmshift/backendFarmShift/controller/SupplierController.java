package com.farmshift.backendFarmShift.controller;

import com.farmshift.backendFarmShift.dto.request.SupplierRequest;
import com.farmshift.backendFarmShift.dto.response.SupplierDebtHistoryResponse;
import com.farmshift.backendFarmShift.dto.response.SupplierResponse;
import com.farmshift.backendFarmShift.dto.response.ApiResponse;
import com.farmshift.backendFarmShift.service.DebtService;
import com.farmshift.backendFarmShift.service.SupplierService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController @RequestMapping("/api/suppliers") @RequiredArgsConstructor
public class SupplierController {
    private final SupplierService service;
    private final DebtService debtService;
    @GetMapping public ApiResponse<List<SupplierResponse>> list() { return ApiResponse.success("Danh sách nhà cung cấp", service.list()); }
    @GetMapping("/{id}") public ApiResponse<SupplierResponse> get(@PathVariable Long id) { return ApiResponse.success("Chi tiết nhà cung cấp", service.get(id)); }
    @GetMapping("/{id}/debt-history") @PreAuthorize("hasAnyAuthority('ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT')")
    public ApiResponse<SupplierDebtHistoryResponse> debtHistory(@PathVariable Long id) { return ApiResponse.success("Lịch sử công nợ nhà cung cấp", debtService.getSupplierDebtHistory(id)); }
    @PostMapping @ResponseStatus(HttpStatus.CREATED) @PreAuthorize("hasAnyAuthority('ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT')")
    public ApiResponse<SupplierResponse> create(@Valid @RequestBody SupplierRequest request) { return ApiResponse.success("Đã thêm nhà cung cấp", service.create(request)); }
    @PutMapping("/{id}") @PreAuthorize("hasAnyAuthority('ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT')")
    public ApiResponse<SupplierResponse> update(@PathVariable Long id, @Valid @RequestBody SupplierRequest request) { return ApiResponse.success("Đã cập nhật nhà cung cấp", service.update(id, request)); }
    @DeleteMapping("/{id}") @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<Void> delete(@PathVariable Long id) { service.delete(id); return ApiResponse.success("Đã xóa nhà cung cấp"); }
}
