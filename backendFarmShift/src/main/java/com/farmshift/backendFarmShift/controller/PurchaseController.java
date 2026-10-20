package com.farmshift.backendFarmShift.controller;

import com.farmshift.backendFarmShift.dto.request.PurchaseInvoiceRequest;
import com.farmshift.backendFarmShift.dto.request.PurchasePaymentRequest;
import com.farmshift.backendFarmShift.dto.response.ApiResponse;
import com.farmshift.backendFarmShift.dto.response.PurchaseInvoiceResponse;
import com.farmshift.backendFarmShift.dto.response.PurchaseOcrResponse;
import com.farmshift.backendFarmShift.service.PurchaseService;
import com.farmshift.backendFarmShift.service.ocr.PurchaseOcrService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/purchases")
@RequiredArgsConstructor
public class PurchaseController {
    private final PurchaseService service;
    private final PurchaseOcrService ocrService;

    @GetMapping
    public ApiResponse<List<PurchaseInvoiceResponse>> list(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String paymentStatus
    ) {
        return ApiResponse.success("Danh sách hóa đơn nhập hàng", service.list(search, paymentStatus));
    }

    @GetMapping("/{id}")
    public ApiResponse<PurchaseInvoiceResponse> get(@PathVariable Long id) {
        return ApiResponse.success("Chi tiết hóa đơn nhập hàng", service.get(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyAuthority('ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT')")
    public ApiResponse<PurchaseInvoiceResponse> create(@Valid @RequestBody PurchaseInvoiceRequest request) {
        return ApiResponse.success("Đã tạo hóa đơn nhập hàng thành công", service.create(request));
    }

    @PostMapping("/{id}/import-stock")
    @PreAuthorize("hasAnyAuthority('ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT', 'ROLE_FARM_WORKER')")
    public ApiResponse<PurchaseInvoiceResponse> importStock(@PathVariable Long id) {
        return ApiResponse.success("Đã xác nhận nhập kho và cập nhật tồn kho", service.importStock(id));
    }

    @PostMapping("/{id}/pay")
    @PreAuthorize("hasAnyAuthority('ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT')")
    public ApiResponse<PurchaseInvoiceResponse> pay(
            @PathVariable Long id,
            @Valid @RequestBody PurchasePaymentRequest request
    ) {
        return ApiResponse.success("Đã ghi nhận thanh toán công nợ", service.pay(id, request));
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasAnyAuthority('ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT')")
    public ApiResponse<Void> cancel(@PathVariable Long id) {
        service.cancel(id);
        return ApiResponse.success("Đã hủy đơn nhập hàng");
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT')")
    public ApiResponse<PurchaseInvoiceResponse> update(@PathVariable Long id,
            @Valid @RequestBody com.farmshift.backendFarmShift.dto.request.PurchaseInvoiceEditRequest request) {
        return ApiResponse.success("Đã cập nhật hóa đơn nhập hàng", service.update(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT')")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ApiResponse.success("Đã xóa hóa đơn nhập hàng");
    }

    @PostMapping("/ocr")
    @PreAuthorize("hasAnyAuthority('ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT')")
    public ApiResponse<PurchaseOcrResponse> ocr(@RequestParam(value = "file", required = false) MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return ApiResponse.success("Đã tải dữ liệu hóa đơn mẫu", ocrService.sample());
        }
        return ApiResponse.success("Bóc tách chứng từ hóa đơn thành công", ocrService.extract(file));
    }
}
