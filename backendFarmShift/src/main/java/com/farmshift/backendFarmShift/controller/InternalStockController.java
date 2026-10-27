package com.farmshift.backendFarmShift.controller;

import com.farmshift.backendFarmShift.dto.request.InternalStockCategoryRequest;
import com.farmshift.backendFarmShift.dto.request.InternalStockVoucherRequest;
import com.farmshift.backendFarmShift.dto.response.ApiResponse;
import com.farmshift.backendFarmShift.dto.response.InternalStockCategoryResponse;
import com.farmshift.backendFarmShift.dto.response.InternalStockVoucherPageResponse;
import com.farmshift.backendFarmShift.dto.response.InternalStockVoucherResponse;
import com.farmshift.backendFarmShift.security.RoleNames;
import com.farmshift.backendFarmShift.service.InternalStockCategoryService;
import com.farmshift.backendFarmShift.service.InternalStockService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;

@RestController
@RequestMapping("/api/internal-stock")
@RequiredArgsConstructor
public class InternalStockController {
    private static final Set<String> FINANCE_ROLES = Set.of(RoleNames.FARM_OWNER, RoleNames.ACCOUNTANT);

    private final InternalStockCategoryService categoryService;
    private final InternalStockService voucherService;

    private static boolean canSeeFinance(Authentication authentication) {
        if (authentication == null) return false;
        return authentication.getAuthorities().stream()
                .anyMatch(authority -> FINANCE_ROLES.contains(authority.getAuthority()));
    }

    // ── Categories ──────────────────────────────────────────────────────────

    @GetMapping("/categories")
    public ApiResponse<List<InternalStockCategoryResponse>> listCategories() {
        return ApiResponse.success("Danh sách danh mục xuất nhập nội bộ", categoryService.list());
    }

    @GetMapping("/categories/{id}")
    public ApiResponse<InternalStockCategoryResponse> getCategory(@PathVariable Long id) {
        return ApiResponse.success("Chi tiết danh mục", categoryService.get(id));
    }

    @PostMapping("/categories")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyAuthority('ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT')")
    public ApiResponse<InternalStockCategoryResponse> createCategory(@Valid @RequestBody InternalStockCategoryRequest request) {
        return ApiResponse.success("Đã tạo danh mục phiếu", categoryService.create(request));
    }

    @PutMapping("/categories/{id}")
    @PreAuthorize("hasAnyAuthority('ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT')")
    public ApiResponse<InternalStockCategoryResponse> updateCategory(@PathVariable Long id, @Valid @RequestBody InternalStockCategoryRequest request) {
        return ApiResponse.success("Đã cập nhật danh mục phiếu", categoryService.update(id, request));
    }

    @DeleteMapping("/categories/{id}")
    @PreAuthorize("hasAnyAuthority('ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT')")
    public ApiResponse<Void> deleteCategory(@PathVariable Long id) {
        categoryService.delete(id);
        return ApiResponse.success("Đã xóa danh mục phiếu");
    }

    // ── Vouchers ────────────────────────────────────────────────────────────

    @GetMapping("/vouchers")
    public ApiResponse<InternalStockVoucherPageResponse> listVouchers(
            @RequestParam(required = false) String movementType,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) Long warehouseId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            Authentication authentication
    ) {
        LocalDate effStart = startDate != null ? startDate : from;
        LocalDate effEnd = endDate != null ? endDate : to;
        String effQ = (q != null && !q.isBlank()) ? q : search;

        Pageable pageable = PageRequest.of(Math.max(0, page), Math.max(1, size), Sort.by(Sort.Direction.DESC, "movementDate", "id"));
        boolean canFinance = canSeeFinance(authentication);
        return ApiResponse.success(
                "Danh sách phiếu xuất nhập nội bộ",
                voucherService.list(movementType, categoryId, warehouseId, status, effStart, effEnd, effQ, pageable, canFinance)
        );
    }

    @GetMapping("/vouchers/{id}")
    public ApiResponse<InternalStockVoucherResponse> getVoucher(@PathVariable Long id, Authentication authentication) {
        return ApiResponse.success("Chi tiết phiếu xuất nhập nội bộ", voucherService.get(id, canSeeFinance(authentication)));
    }

    @PostMapping("/vouchers")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyAuthority('ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT')")
    public ApiResponse<InternalStockVoucherResponse> createVoucher(
            @Valid @RequestBody InternalStockVoucherRequest request,
            Authentication authentication
    ) {
        String createdBy = authentication != null ? authentication.getName() : "system";
        return ApiResponse.success("Đã lập phiếu xuất nhập nội bộ", voucherService.create(request, createdBy));
    }

    @PostMapping("/vouchers/{id}/cancel")
    @PreAuthorize("hasAnyAuthority('ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT')")
    public ApiResponse<InternalStockVoucherResponse> cancelVoucher(
            @PathVariable Long id,
            Authentication authentication
    ) {
        String user = authentication != null ? authentication.getName() : "system";
        return ApiResponse.success("Đã hủy phiếu xuất nhập nội bộ", voucherService.cancel(id, user));
    }
}
