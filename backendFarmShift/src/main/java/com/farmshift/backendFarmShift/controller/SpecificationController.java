package com.farmshift.backendFarmShift.controller;

import com.farmshift.backendFarmShift.dto.request.SpecificationRequest;
import com.farmshift.backendFarmShift.dto.response.ApiResponse;
import com.farmshift.backendFarmShift.dto.response.SpecificationResponse;
import com.farmshift.backendFarmShift.service.SpecificationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/specifications")
@RequiredArgsConstructor
public class SpecificationController {
    private final SpecificationService service;

    @GetMapping
    public ApiResponse<List<SpecificationResponse>> list() {
        return ApiResponse.success("Danh sách quy cách", service.list());
    }

    @GetMapping("/{id}")
    public ApiResponse<SpecificationResponse> get(@PathVariable Long id) {
        return ApiResponse.success("Chi tiết quy cách", service.get(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<SpecificationResponse> create(@Valid @RequestBody SpecificationRequest request) {
        return ApiResponse.success("Đã thêm quy cách", service.create(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<SpecificationResponse> update(@PathVariable Long id, @Valid @RequestBody SpecificationRequest request) {
        return ApiResponse.success("Đã cập nhật quy cách", service.update(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ApiResponse.success("Đã xóa quy cách");
    }
}
