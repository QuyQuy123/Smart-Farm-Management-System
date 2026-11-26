package com.farmshift.backendFarmShift.controller;

import com.farmshift.backendFarmShift.dto.request.CycleDiseaseRequest;
import com.farmshift.backendFarmShift.dto.request.CycleDiseaseUpdateRequest;
import com.farmshift.backendFarmShift.dto.request.DiseaseTreatmentRequest;
import com.farmshift.backendFarmShift.dto.response.ApiResponse;
import com.farmshift.backendFarmShift.dto.response.CycleDiseaseResponse;
import com.farmshift.backendFarmShift.dto.response.CycleDiseaseResponse.MedicineSource;
import com.farmshift.backendFarmShift.security.RoleNames;
import com.farmshift.backendFarmShift.service.CycleDiseaseService;
import com.farmshift.backendFarmShift.service.CycleService;
import com.farmshift.backendFarmShift.service.WorkAssignmentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Sổ bệnh án lứa nuôi (OPS-02): theo dõi đợt bệnh nhiều ngày, trừ kho FIFO và tổng tiền thuốc từng bệnh.
 */
@RestController
@RequestMapping("/api/cycles/{cycleId}/diseases")
@RequiredArgsConstructor
public class CycleDiseaseController {
    private final CycleDiseaseService diseaseService;
    private final CycleService cycleService;
    private final WorkAssignmentService workAssignment;

    private static boolean isOwner(Authentication auth) {
        return auth != null && auth.getAuthorities().stream()
                .anyMatch(a -> RoleNames.FARM_OWNER.equals(a.getAuthority()));
    }

    private static boolean isWorker(Authentication auth) {
        return auth != null && auth.getAuthorities().stream()
                .anyMatch(a -> RoleNames.FARM_WORKER.equals(a.getAuthority()));
    }

    @GetMapping
    @PreAuthorize("hasAnyAuthority('ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT', 'ROLE_FARM_WORKER')")
    public ApiResponse<List<CycleDiseaseResponse>> list(@PathVariable Long cycleId, Authentication auth) {
        if (isWorker(auth)) {
            workAssignment.requireAssigned(auth, cycleService.barnIdOf(cycleId));
        }
        return ApiResponse.success("Sổ bệnh án của lứa nuôi", diseaseService.list(cycleId, CycleController.canSeeFinance(auth)));
    }

    @GetMapping("/medicine-sources")
    @PreAuthorize("hasAnyAuthority('ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT', 'ROLE_FARM_WORKER')")
    public ApiResponse<List<MedicineSource>> medicineSources(@PathVariable Long cycleId, Authentication auth) {
        if (isWorker(auth)) {
            workAssignment.requireAssigned(auth, cycleService.barnIdOf(cycleId));
        }
        return ApiResponse.success("Danh sách thuốc kho khu nuôi", diseaseService.listMedicineSources(cycleId, CycleController.canSeeFinance(auth)));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyAuthority('ROLE_FARM_OWNER', 'ROLE_FARM_WORKER')")
    public ApiResponse<CycleDiseaseResponse> create(@PathVariable Long cycleId,
                                                    @Valid @RequestBody CycleDiseaseRequest request,
                                                    Authentication auth) {
        if (isWorker(auth)) {
            workAssignment.requireAssigned(auth, cycleService.barnIdOf(cycleId));
        }
        return ApiResponse.success("Đã khai báo đợt bệnh",
                diseaseService.createDisease(cycleId, request, auth.getName(), CycleController.canSeeFinance(auth)));
    }

    @PutMapping("/{diseaseId}")
    @PreAuthorize("hasAnyAuthority('ROLE_FARM_OWNER', 'ROLE_FARM_WORKER')")
    public ApiResponse<CycleDiseaseResponse> update(@PathVariable Long cycleId,
                                                    @PathVariable Long diseaseId,
                                                    @Valid @RequestBody CycleDiseaseUpdateRequest request,
                                                    Authentication auth) {
        if (isWorker(auth)) {
            workAssignment.requireAssigned(auth, cycleService.barnIdOf(cycleId));
        }
        return ApiResponse.success("Đã cập nhật đợt bệnh",
                diseaseService.updateDisease(cycleId, diseaseId, request, CycleController.canSeeFinance(auth)));
    }

    @DeleteMapping("/{diseaseId}")
    @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<Void> delete(@PathVariable Long cycleId, @PathVariable Long diseaseId) {
        diseaseService.deleteDisease(cycleId, diseaseId);
        return ApiResponse.success("Đã xóa đợt bệnh");
    }

    @PostMapping("/{diseaseId}/treatments")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyAuthority('ROLE_FARM_OWNER', 'ROLE_FARM_WORKER')")
    public ApiResponse<CycleDiseaseResponse> addTreatment(@PathVariable Long cycleId,
                                                          @PathVariable Long diseaseId,
                                                          @Valid @RequestBody DiseaseTreatmentRequest request,
                                                          Authentication auth) {
        if (isWorker(auth)) {
            workAssignment.requireAssigned(auth, cycleService.barnIdOf(cycleId));
        }
        return ApiResponse.success("Đã ghi nhận lần dùng thuốc",
                diseaseService.addTreatment(cycleId, diseaseId, request, auth.getName(), CycleController.canSeeFinance(auth)));
    }

    @DeleteMapping("/{diseaseId}/treatments/{treatmentId}")
    @PreAuthorize("hasAnyAuthority('ROLE_FARM_OWNER', 'ROLE_FARM_WORKER')")
    public ApiResponse<CycleDiseaseResponse> deleteTreatment(@PathVariable Long cycleId,
                                                             @PathVariable Long diseaseId,
                                                             @PathVariable Long treatmentId,
                                                             Authentication auth) {
        if (isWorker(auth)) {
            workAssignment.requireAssigned(auth, cycleService.barnIdOf(cycleId));
        }
        return ApiResponse.success("Đã hoàn tác lần dùng thuốc và hoàn lại tồn kho",
                diseaseService.deleteTreatment(cycleId, diseaseId, treatmentId, auth.getName(), isOwner(auth), CycleController.canSeeFinance(auth)));
    }
}
