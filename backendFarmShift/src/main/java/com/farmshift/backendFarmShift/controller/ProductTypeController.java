package com.farmshift.backendFarmShift.controller;

import com.farmshift.backendFarmShift.dto.request.ProductTypeRequest;
import com.farmshift.backendFarmShift.dto.response.ApiResponse;
import com.farmshift.backendFarmShift.dto.response.ProductTypeResponse;
import com.farmshift.backendFarmShift.service.ProductTypeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/product-types")
@RequiredArgsConstructor
public class ProductTypeController {
    private final ProductTypeService service;

    @GetMapping
    public ApiResponse<List<ProductTypeResponse>> list() {
        return ApiResponse.success("Danh sách loại hàng hóa", service.list());
    }

    @GetMapping("/{id}")
    public ApiResponse<ProductTypeResponse> get(@PathVariable Long id) {
        return ApiResponse.success("Chi tiết loại hàng hóa", service.get(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<ProductTypeResponse> create(@Valid @RequestBody ProductTypeRequest request) {
        return ApiResponse.success("Đã thêm loại hàng hóa", service.create(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<ProductTypeResponse> update(@PathVariable Long id, @Valid @RequestBody ProductTypeRequest request) {
        return ApiResponse.success("Đã cập nhật loại hàng hóa", service.update(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ApiResponse.success("Đã xóa loại hàng hóa");
    }
}
