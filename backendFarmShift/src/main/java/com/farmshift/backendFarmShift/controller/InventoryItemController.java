package com.farmshift.backendFarmShift.controller;

import com.farmshift.backendFarmShift.dto.request.InventoryItemRequest;
import com.farmshift.backendFarmShift.dto.response.InventoryItemResponse;
import com.farmshift.backendFarmShift.dto.response.ApiResponse;
import com.farmshift.backendFarmShift.security.RoleNames;
import com.farmshift.backendFarmShift.service.InventoryItemService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController @RequestMapping("/api/inventory-items") @RequiredArgsConstructor
public class InventoryItemController {
    private final InventoryItemService service;

    private static boolean canSeeFinance(Authentication authentication) {
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(a -> RoleNames.FARM_OWNER.equals(a.getAuthority()) || RoleNames.ACCOUNTANT.equals(a.getAuthority()));
    }

    private static boolean isWorker(Authentication authentication) {
        return authentication != null
                && !canSeeFinance(authentication)
                && authentication.getAuthorities().stream()
                        .anyMatch(a -> RoleNames.FARM_WORKER.equals(a.getAuthority()));
    }

    @GetMapping
    @PreAuthorize("hasAnyAuthority('ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT', 'ROLE_FARM_WORKER')")
    public ApiResponse<List<InventoryItemResponse>> list(
            @RequestParam(required = false) Long warehouseId,
            @RequestParam(defaultValue = "false") boolean includeReceipts,
            Authentication authentication
    ) {
        boolean finance = canSeeFinance(authentication);
        String workerEmail = isWorker(authentication) ? authentication.getName() : null;
        return ApiResponse.success("Danh sách hàng hóa", service.list(warehouseId, finance && includeReceipts, finance, workerEmail));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT', 'ROLE_FARM_WORKER')")
    public ApiResponse<InventoryItemResponse> get(@PathVariable Long id, Authentication authentication) {
        boolean finance = canSeeFinance(authentication);
        String workerEmail = isWorker(authentication) ? authentication.getName() : null;
        return ApiResponse.success("Chi tiết hàng hóa", service.get(id, finance, workerEmail));
    }

    @PostMapping @ResponseStatus(HttpStatus.CREATED) @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<InventoryItemResponse> create(@Valid @RequestBody InventoryItemRequest request) { return ApiResponse.success("Đã thêm hàng hóa", service.create(request)); }
    @PutMapping("/{id}") @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<InventoryItemResponse> update(@PathVariable Long id, @Valid @RequestBody InventoryItemRequest request) { return ApiResponse.success("Đã cập nhật hàng hóa", service.update(id, request)); }
    @DeleteMapping("/{id}") @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<Void> delete(@PathVariable Long id) { service.delete(id); return ApiResponse.success("Đã xóa hàng hóa"); }
}
