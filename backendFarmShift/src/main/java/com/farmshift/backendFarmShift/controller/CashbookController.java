package com.farmshift.backendFarmShift.controller;

import com.farmshift.backendFarmShift.dto.request.CashFundRequest;
import com.farmshift.backendFarmShift.dto.request.CashFundTransferRequest;
import com.farmshift.backendFarmShift.dto.request.CashTransactionRequest;
import com.farmshift.backendFarmShift.dto.response.ApiResponse;
import com.farmshift.backendFarmShift.dto.response.CashbookSummaryResponse;
import com.farmshift.backendFarmShift.dto.response.CashbookSummaryResponse.FundResponse;
import com.farmshift.backendFarmShift.dto.response.CashbookSummaryResponse.TransactionResponse;
import com.farmshift.backendFarmShift.dto.response.CashbookSummaryResponse.TransferResponse;
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
}

