package com.farmshift.backendFarmShift.controller;

import com.farmshift.backendFarmShift.dto.request.FarmAreaRequest;
import com.farmshift.backendFarmShift.dto.response.ApiResponse;
import com.farmshift.backendFarmShift.dto.response.FarmAreaResponse;
import com.farmshift.backendFarmShift.service.FarmAreaService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/farm-areas")
@RequiredArgsConstructor
public class FarmAreaController {
    private final FarmAreaService service;

    @GetMapping
    public ApiResponse<List<FarmAreaResponse>> list() {
        return ApiResponse.success("Danh sách khu nuôi", service.list());
    }

    @GetMapping("/{id}")
    public ApiResponse<FarmAreaResponse> get(@PathVariable Long id) {
        return ApiResponse.success("Chi tiết khu nuôi", service.get(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<FarmAreaResponse> create(@Valid @RequestBody FarmAreaRequest request) {
        return ApiResponse.success("Đã thêm khu nuôi", service.create(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<FarmAreaResponse> update(@PathVariable Long id, @Valid @RequestBody FarmAreaRequest request) {
        return ApiResponse.success("Đã cập nhật khu nuôi", service.update(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ApiResponse.success("Đã xóa khu nuôi");
    }
}
