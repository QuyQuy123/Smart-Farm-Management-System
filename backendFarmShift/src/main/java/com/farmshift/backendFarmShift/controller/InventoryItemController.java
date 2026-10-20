package com.farmshift.backendFarmShift.controller;

import com.farmshift.backendFarmShift.dto.request.InventoryItemRequest;
import com.farmshift.backendFarmShift.dto.response.InventoryItemResponse;
import com.farmshift.backendFarmShift.dto.response.ApiResponse;
import com.farmshift.backendFarmShift.service.InventoryItemService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController @RequestMapping("/api/inventory-items") @RequiredArgsConstructor
public class InventoryItemController {
    private final InventoryItemService service;
    @GetMapping public ApiResponse<List<InventoryItemResponse>> list(@RequestParam(required = false) Long warehouseId) { return ApiResponse.success("Danh sách hàng hóa", service.list(warehouseId)); }
    @GetMapping("/{id}") public ApiResponse<InventoryItemResponse> get(@PathVariable Long id) { return ApiResponse.success("Chi tiết hàng hóa", service.get(id)); }
    @PostMapping @ResponseStatus(HttpStatus.CREATED) @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<InventoryItemResponse> create(@Valid @RequestBody InventoryItemRequest request) { return ApiResponse.success("Đã thêm hàng hóa", service.create(request)); }
    @PutMapping("/{id}") @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<InventoryItemResponse> update(@PathVariable Long id, @Valid @RequestBody InventoryItemRequest request) { return ApiResponse.success("Đã cập nhật hàng hóa", service.update(id, request)); }
    @DeleteMapping("/{id}") @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<Void> delete(@PathVariable Long id) { service.delete(id); return ApiResponse.success("Đã xóa hàng hóa"); }
}
