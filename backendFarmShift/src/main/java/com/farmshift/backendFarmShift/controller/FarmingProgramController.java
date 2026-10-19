package com.farmshift.backendFarmShift.controller;

import com.farmshift.backendFarmShift.dto.request.FarmingProgramRequest;
import com.farmshift.backendFarmShift.dto.response.ApiResponse;
import com.farmshift.backendFarmShift.dto.response.FarmingProgramResponse;
import com.farmshift.backendFarmShift.service.FarmingProgramService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/farming-programs")
@RequiredArgsConstructor
public class FarmingProgramController {
    private final FarmingProgramService service;

    @GetMapping
    public ApiResponse<List<FarmingProgramResponse>> list() {
        return ApiResponse.success("Danh sách chương trình nuôi", service.list());
    }

    @GetMapping("/{id}")
    public ApiResponse<FarmingProgramResponse> get(@PathVariable Long id) {
        return ApiResponse.success("Chi tiết chương trình nuôi", service.get(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<FarmingProgramResponse> create(@Valid @RequestBody FarmingProgramRequest request) {
        return ApiResponse.success("Đã thêm chương trình nuôi", service.create(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<FarmingProgramResponse> update(@PathVariable Long id, @Valid @RequestBody FarmingProgramRequest request) {
        return ApiResponse.success("Đã cập nhật chương trình nuôi", service.update(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ApiResponse.success("Đã xóa chương trình nuôi");
    }
}
