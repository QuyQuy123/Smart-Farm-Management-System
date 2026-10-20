package com.farmshift.backendFarmShift.controller;

import com.farmshift.backendFarmShift.dto.request.TransferCategoryRequest;
import com.farmshift.backendFarmShift.dto.response.ApiResponse;
import com.farmshift.backendFarmShift.dto.response.TransferCategoryResponse;
import com.farmshift.backendFarmShift.service.TransferCategoryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/transfer-categories")
@RequiredArgsConstructor
public class TransferCategoryController {
    private final TransferCategoryService service;

    @GetMapping
    public ApiResponse<List<TransferCategoryResponse>> list() {
        return ApiResponse.success("Danh sách danh mục phiếu", service.list());
    }

    @GetMapping("/{id}")
    public ApiResponse<TransferCategoryResponse> get(@PathVariable Long id) {
        return ApiResponse.success("Chi tiết danh mục phiếu", service.get(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<TransferCategoryResponse> create(@Valid @RequestBody TransferCategoryRequest request) {
        return ApiResponse.success("Đã thêm danh mục phiếu", service.create(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<TransferCategoryResponse> update(@PathVariable Long id, @Valid @RequestBody TransferCategoryRequest request) {
        return ApiResponse.success("Đã cập nhật danh mục phiếu", service.update(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ApiResponse.success("Đã xóa danh mục phiếu");
    }
}
