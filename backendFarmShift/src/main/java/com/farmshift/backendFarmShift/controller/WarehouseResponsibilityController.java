package com.farmshift.backendFarmShift.controller;

import com.farmshift.backendFarmShift.dto.request.WarehouseWorkersRequest;
import com.farmshift.backendFarmShift.dto.response.ApiResponse;
import com.farmshift.backendFarmShift.dto.response.WarehouseResponsibilities;
import com.farmshift.backendFarmShift.dto.response.WorkBoard;
import com.farmshift.backendFarmShift.service.WarehouseResponsibilityService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
public class WarehouseResponsibilityController {
    private final WarehouseResponsibilityService service;

    @GetMapping("/api/warehouse-responsibilities")
    public ApiResponse<WarehouseResponsibilities> settings() {
        return ApiResponse.success("Công nhân phụ trách kho", service.settings());
    }

    @PutMapping("/api/warehouse-categories/{id}/workers")
    public ApiResponse<List<WorkBoard.WorkerRef>> setWorkers(@PathVariable Long id, @Valid @RequestBody WarehouseWorkersRequest request) {
        return ApiResponse.success("Đã cập nhật công nhân phụ trách kho", service.setWorkers(id, request.workerIds()));
    }
}
