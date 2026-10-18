package com.farmshift.backendFarmShift.controller;

import com.farmshift.backendFarmShift.dto.request.ProductCategoryRequest;
import com.farmshift.backendFarmShift.dto.response.ApiResponse;
import com.farmshift.backendFarmShift.dto.response.ProductCategoryResponse;
import com.farmshift.backendFarmShift.service.ProductCategoryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/product-categories")
@RequiredArgsConstructor
public class ProductCategoryController {
    private final ProductCategoryService service;

    @GetMapping
    public ApiResponse<List<ProductCategoryResponse>> list() {
        return ApiResponse.success("Danh sách danh mục hàng hóa", service.list());
    }

    @GetMapping("/{id}")
    public ApiResponse<ProductCategoryResponse> get(@PathVariable Long id) {
        return ApiResponse.success("Chi tiết danh mục hàng hóa", service.get(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<ProductCategoryResponse> create(@Valid @RequestBody ProductCategoryRequest request) {
        return ApiResponse.success("Đã thêm danh mục hàng hóa", service.create(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<ProductCategoryResponse> update(@PathVariable Long id, @Valid @RequestBody ProductCategoryRequest request) {
        return ApiResponse.success("Đã cập nhật danh mục hàng hóa", service.update(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ApiResponse.success("Đã xóa danh mục hàng hóa");
    }
}
