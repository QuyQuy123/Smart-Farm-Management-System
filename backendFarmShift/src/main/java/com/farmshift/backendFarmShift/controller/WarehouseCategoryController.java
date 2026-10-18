package com.farmshift.backendFarmShift.controller;

import com.farmshift.backendFarmShift.dto.request.WarehouseCategoryRequest;
import com.farmshift.backendFarmShift.dto.response.ApiResponse;
import com.farmshift.backendFarmShift.dto.response.WarehouseCategoryResponse;
import com.farmshift.backendFarmShift.service.WarehouseCategoryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/warehouse-categories")
@RequiredArgsConstructor
public class WarehouseCategoryController {
    private final WarehouseCategoryService service;

    @GetMapping
    public ApiResponse<List<WarehouseCategoryResponse>> list() {
        return ApiResponse.success("Danh sách danh mục kho", service.list());
    }

    @GetMapping("/{id}")
    public ApiResponse<WarehouseCategoryResponse> get(@PathVariable Long id) {
        return ApiResponse.success("Chi tiết danh mục kho", service.get(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<WarehouseCategoryResponse> create(@Valid @RequestBody WarehouseCategoryRequest request) {
        return ApiResponse.success("Đã thêm danh mục kho", service.create(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<WarehouseCategoryResponse> update(@PathVariable Long id, @Valid @RequestBody WarehouseCategoryRequest request) {
        return ApiResponse.success("Đã cập nhật danh mục kho", service.update(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ApiResponse.success("Đã xóa danh mục kho");
    }
}
