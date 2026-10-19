package com.farmshift.backendFarmShift.controller;

import com.farmshift.backendFarmShift.dto.request.MeasurementUnitRequest;
import com.farmshift.backendFarmShift.dto.response.MeasurementUnitResponse;
import com.farmshift.backendFarmShift.dto.response.ApiResponse;
import com.farmshift.backendFarmShift.service.MeasurementUnitService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/measurement-units")
@RequiredArgsConstructor
public class MeasurementUnitController {
    private final MeasurementUnitService service;
    @GetMapping
    public ApiResponse<List<MeasurementUnitResponse>> list() { return ApiResponse.success("Danh sách đơn vị tính", service.list()); }
    @GetMapping("/{id}")
    public ApiResponse<MeasurementUnitResponse> get(@PathVariable Long id) { return ApiResponse.success("Chi tiết đơn vị tính", service.get(id)); }
    @PostMapping @ResponseStatus(HttpStatus.CREATED) @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<MeasurementUnitResponse> create(@Valid @RequestBody MeasurementUnitRequest request) { return ApiResponse.success("Đã thêm đơn vị tính", service.create(request)); }
    @PutMapping("/{id}") @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<MeasurementUnitResponse> update(@PathVariable Long id, @Valid @RequestBody MeasurementUnitRequest request) { return ApiResponse.success("Đã cập nhật đơn vị tính", service.update(id, request)); }
    @DeleteMapping("/{id}") @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<Void> delete(@PathVariable Long id) { service.delete(id); return ApiResponse.success("Đã xóa đơn vị tính"); }
}
