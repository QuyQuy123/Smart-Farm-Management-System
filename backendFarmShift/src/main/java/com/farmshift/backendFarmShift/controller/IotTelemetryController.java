package com.farmshift.backendFarmShift.controller;

import com.farmshift.backendFarmShift.dto.response.ApiResponse;
import com.farmshift.backendFarmShift.dto.request.IotTelemetryPushRequest;
import com.farmshift.backendFarmShift.entity.Barn;
import com.farmshift.backendFarmShift.exception.ResourceNotFoundException;
import com.farmshift.backendFarmShift.repository.BarnRepository;
import com.farmshift.backendFarmShift.service.CycleService;
import com.farmshift.backendFarmShift.service.WorkAssignmentService;
import com.farmshift.backendFarmShift.service.iot.IotTelemetryRegistry;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/iot/telemetry")
@RequiredArgsConstructor
public class IotTelemetryController {

    private final IotTelemetryRegistry telemetryRegistry;
    private final BarnRepository barnRepository;
    private final WorkAssignmentService workAssignmentService;

    @PostMapping
    @PreAuthorize("hasAnyAuthority('ROLE_FARM_OWNER', 'ROLE_FARM_WORKER')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> publishTelemetry(
            @Valid @RequestBody IotTelemetryPushRequest request,
            Authentication authentication
    ) {
        workAssignmentService.requireAssigned(authentication, request.barnId());
        Barn barn = barnRepository.findById(request.barnId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy chuồng nuôi."));

        var snap = telemetryRegistry.record(
                barn.getId(),
                barn.getName(),
                Boolean.TRUE.equals(request.connected()),
                request.temp1(),
                request.humi1(),
                request.temp3(),
                request.humi3(),
                request.relayStates(),
                request.activeDeviceLabels(),
                request.source()
        );

        return ResponseEntity.ok(ApiResponse.success("Đã đồng bộ dữ liệu cảm biến IoT.", toMap(snap)));
    }

    @GetMapping("/{barnId}")
    @PreAuthorize("hasAnyAuthority('ROLE_FARM_OWNER', 'ROLE_FARM_WORKER')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getTelemetry(
            @PathVariable Long barnId,
            Authentication authentication
    ) {
        workAssignmentService.requireAssigned(authentication, barnId);
        Barn barn = barnRepository.findById(barnId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy chuồng nuôi."));

        var snapOpt = telemetryRegistry.get(barnId);
        if (snapOpt.isEmpty()) {
            Map<String, Object> empty = new LinkedHashMap<>();
            empty.put("barnId", barn.getId());
            empty.put("barnName", barn.getName());
            empty.put("status", "NO_LIVE_TELEMETRY");
            empty.put("connected", false);
            return ResponseEntity.ok(ApiResponse.success("Chưa có dữ liệu cảm biến IoT.", empty));
        }

        return ResponseEntity.ok(ApiResponse.success("Thông số cảm biến IoT.", toMap(snapOpt.get())));
    }

    private Map<String, Object> toMap(IotTelemetryRegistry.BarnTelemetrySnapshot snap) {
        LocalDateTime now = LocalDateTime.now(CycleService.VN_ZONE);
        boolean fresh = snap.isFresh(now);
        String status = (snap.connected() && fresh) ? "LIVE" : (fresh ? "DISCONNECTED" : "STALE");

        Map<String, Object> map = new LinkedHashMap<>();
        map.put("barnId", snap.barnId());
        map.put("barnName", snap.barnName());
        map.put("status", status);
        map.put("connected", snap.connected());
        map.put("fresh", fresh);
        map.put("temp1", snap.temp1());
        map.put("humi1", snap.humi1());
        map.put("temp3", snap.temp3());
        map.put("humi3", snap.humi3());
        map.put("avgTemperature", snap.avgTemperature());
        map.put("avgHumidity", snap.avgHumidity());
        map.put("relayStates", snap.relayStates());
        map.put("activeDeviceLabels", snap.activeDeviceLabels());
        map.put("source", snap.source());
        map.put("updatedAt", snap.updatedAt() != null ? snap.updatedAt().toString() : null);
        return map;
    }
}
