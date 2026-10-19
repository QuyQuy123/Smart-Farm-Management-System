package com.farmshift.backendFarmShift.controller;

import com.farmshift.backendFarmShift.dto.request.PurchaseTagRequest;
import com.farmshift.backendFarmShift.dto.response.ApiResponse;
import com.farmshift.backendFarmShift.dto.response.PurchaseTagResponse;
import com.farmshift.backendFarmShift.service.PurchaseTagService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/purchase-tags")
@RequiredArgsConstructor
public class PurchaseTagController {
    private final PurchaseTagService service;

    @GetMapping
    public ApiResponse<List<PurchaseTagResponse>> list() {
        return ApiResponse.success("Danh sách thẻ phân loại", service.list());
    }

    @GetMapping("/{id}")
    public ApiResponse<PurchaseTagResponse> get(@PathVariable Long id) {
        return ApiResponse.success("Chi tiết thẻ phân loại", service.get(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<PurchaseTagResponse> create(@Valid @RequestBody PurchaseTagRequest request) {
        return ApiResponse.success("Đã thêm thẻ phân loại", service.create(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<PurchaseTagResponse> update(@PathVariable Long id, @Valid @RequestBody PurchaseTagRequest request) {
        return ApiResponse.success("Đã cập nhật thẻ phân loại", service.update(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ApiResponse.success("Đã xóa thẻ phân loại");
    }
}
