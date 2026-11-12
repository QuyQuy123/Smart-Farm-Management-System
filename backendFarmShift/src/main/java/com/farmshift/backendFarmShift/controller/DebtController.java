package com.farmshift.backendFarmShift.controller;

import com.farmshift.backendFarmShift.dto.response.ApiResponse;
import com.farmshift.backendFarmShift.dto.response.DebtSummaryResponse;
import com.farmshift.backendFarmShift.dto.response.SupplierDebtHistoryResponse;
import com.farmshift.backendFarmShift.service.DebtService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/debts")
@RequiredArgsConstructor
public class DebtController {
    private final DebtService debtService;

    @GetMapping("/summary")
    @PreAuthorize("hasAnyAuthority('ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT')")
    public ApiResponse<DebtSummaryResponse> summary() {
        return ApiResponse.success("Tổng hợp công nợ phải trả & phải thu", debtService.getDebtSummary());
    }

    @GetMapping("/suppliers/{id}")
    @PreAuthorize("hasAnyAuthority('ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT')")
    public ApiResponse<SupplierDebtHistoryResponse> supplierHistory(@PathVariable Long id) {
        return ApiResponse.success("Lịch sử công nợ nhà cung cấp", debtService.getSupplierDebtHistory(id));
    }
}

