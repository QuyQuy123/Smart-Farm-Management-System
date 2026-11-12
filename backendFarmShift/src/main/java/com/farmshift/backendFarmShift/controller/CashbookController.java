package com.farmshift.backendFarmShift.controller;

import com.farmshift.backendFarmShift.dto.request.*;
import com.farmshift.backendFarmShift.dto.response.ApiResponse;
import com.farmshift.backendFarmShift.dto.response.CashbookSummaryResponse;
import com.farmshift.backendFarmShift.dto.response.CashbookSummaryResponse.*;
import com.farmshift.backendFarmShift.service.CashbookService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/cashbook")
@RequiredArgsConstructor
@PreAuthorize("hasAnyAuthority('ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT')")
public class CashbookController {
    private final CashbookService cashbookService;

    @GetMapping("/summary")
    public ApiResponse<CashbookSummaryResponse> summary(
            @RequestParam(required = false, defaultValue = "ALL") String type,
            @RequestParam(required = false) Long fundId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String search
    ) {
        return ApiResponse.success("Dữ liệu sổ quỹ & nguồn tiền", cashbookService.getSummary(type, fundId, from, to, search));
    }

    @GetMapping("/funds")
    public ApiResponse<List<FundResponse>> listFunds() {
        return ApiResponse.success("Danh sách nguồn quỹ", cashbookService.listFunds());
    }

    @PostMapping("/funds")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<FundResponse> createFund(@Valid @RequestBody CashFundRequest request) {
        return ApiResponse.success("Đã thêm nguồn quỹ mới", cashbookService.createFund(request));
    }

    @PutMapping("/funds/{id}")
    public ApiResponse<FundResponse> updateFund(@PathVariable Long id, @Valid @RequestBody CashFundRequest request) {
        return ApiResponse.success("Đã cập nhật nguồn quỹ", cashbookService.updateFund(id, request));
    }

    @DeleteMapping("/funds/{id}")
    public ApiResponse<Void> deleteFund(@PathVariable Long id) {
        cashbookService.deleteFund(id);
        return ApiResponse.success("Đã xóa nguồn quỹ");
    }

    @PostMapping("/transactions")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<TransactionResponse> createTransaction(@Valid @RequestBody CashTransactionRequest request) {
        return ApiResponse.success("Đã lập phiếu thu / chi", cashbookService.createTransaction(request));
    }

    @PutMapping("/transactions/{id}")
    public ApiResponse<TransactionResponse> updateTransaction(@PathVariable Long id, @Valid @RequestBody CashTransactionRequest request) {
        return ApiResponse.success("Đã cập nhật phiếu thu / chi", cashbookService.updateTransaction(id, request));
    }

    @DeleteMapping("/transactions/{id}")
    public ApiResponse<Void> deleteTransaction(@PathVariable Long id) {
        cashbookService.deleteTransaction(id);
        return ApiResponse.success("Đã xóa phiếu thu / chi");
    }

    @PostMapping("/transfers")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<TransferResponse> createTransfer(@Valid @RequestBody CashFundTransferRequest request) {
        return ApiResponse.success("Đã chuyển quỹ nội bộ", cashbookService.createTransfer(request));
    }

    // ── Phân bổ chi phí lứa ──────────────────────────────────────────────────────────────

    @PostMapping("/cost-allocations")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<CostAllocationResponse> createCostAllocation(@Valid @RequestBody CycleCostAllocationRequest request) {
        return ApiResponse.success("Đã ghi nhận phân bổ chi phí lứa", cashbookService.createCostAllocation(request));
    }

    @PutMapping("/cost-allocations/{id}")
    public ApiResponse<CostAllocationResponse> updateCostAllocation(@PathVariable Long id, @Valid @RequestBody CycleCostAllocationRequest request) {
        return ApiResponse.success("Đã cập nhật phân bổ chi phí lứa", cashbookService.updateCostAllocation(id, request));
    }

    @DeleteMapping("/cost-allocations/{id}")
    public ApiResponse<Void> deleteCostAllocation(@PathVariable Long id) {
        cashbookService.deleteCostAllocation(id);
        return ApiResponse.success("Đã xóa phân bổ chi phí lứa");
    }

    // ── Tài sản cố định & Khấu hao ──────────────────────────────────────────────────────

    @PostMapping("/assets")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<AssetResponse> createAsset(@Valid @RequestBody FarmAssetRequest request) {
        return ApiResponse.success("Đã thêm tài sản cố định", cashbookService.createAsset(request));
    }

    @PutMapping("/assets/{id}")
    public ApiResponse<AssetResponse> updateAsset(@PathVariable Long id, @Valid @RequestBody FarmAssetRequest request) {
        return ApiResponse.success("Đã cập nhật tài sản cố định", cashbookService.updateAsset(id, request));
    }

    @DeleteMapping("/assets/{id}")
    public ApiResponse<Void> deleteAsset(@PathVariable Long id) {
        cashbookService.deleteAsset(id);
        return ApiResponse.success("Đã xóa tài sản cố định");
    }

    // ── Tiền công nhân viên ──────────────────────────────────────────────────────────────

    @PostMapping("/payrolls")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<PayrollResponse> createPayroll(@Valid @RequestBody PayrollRequest request) {
        return ApiResponse.success("Đã tạo bảng chấm công & tiền lương", cashbookService.createPayroll(request));
    }

    @PutMapping("/payrolls/{id}")
    public ApiResponse<PayrollResponse> updatePayroll(@PathVariable Long id, @Valid @RequestBody PayrollRequest request) {
        return ApiResponse.success("Đã cập nhật bảng lương nhân viên", cashbookService.updatePayroll(id, request));
    }

    @PostMapping("/payrolls/{id}/pay")
    public ApiResponse<PayrollResponse> payPayroll(@PathVariable Long id, @Valid @RequestBody PayrollPayRequest request) {
        return ApiResponse.success("Đã chi trả lương và lập phiếu chi quỹ", cashbookService.payPayroll(id, request));
    }

    @DeleteMapping("/payrolls/{id}")
    public ApiResponse<Void> deletePayroll(@PathVariable Long id) {
        cashbookService.deletePayroll(id);
        return ApiResponse.success("Đã xóa bảng lương nhân viên");
    }

    // ── Danh mục loại phiếu thu / chi ────────────────────────────────────────────────────

    @PostMapping("/categories")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<CategoryResponse> createCategory(@Valid @RequestBody CashTransactionCategoryRequest request) {
        return ApiResponse.success("Đã thêm loại phiếu thu / chi", cashbookService.createCategory(request));
    }

    @PutMapping("/categories/{id}")
    public ApiResponse<CategoryResponse> updateCategory(@PathVariable Long id, @Valid @RequestBody CashTransactionCategoryRequest request) {
        return ApiResponse.success("Đã cập nhật loại phiếu thu / chi", cashbookService.updateCategory(id, request));
    }

    @DeleteMapping("/categories/{id}")
    public ApiResponse<Void> deleteCategory(@PathVariable Long id) {
        cashbookService.deleteCategory(id);
        return ApiResponse.success("Đã xóa loại phiếu thu / chi");
    }
}
