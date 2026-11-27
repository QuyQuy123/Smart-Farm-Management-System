package com.farmshift.backendFarmShift.controller;

import com.farmshift.backendFarmShift.dto.response.ApiResponse;
import com.farmshift.backendFarmShift.service.BarnService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.time.Instant;
import java.sql.Timestamp;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/barns/{barnId}/iot-events")
@RequiredArgsConstructor
public class IotEventController {
    private final JdbcTemplate jdbc;
    private final BarnService barns;

    public record Activation(@NotNull UUID id, @NotBlank @Size(max=100) String deviceName,
        @NotNull @Pattern(regexp="FAN|WATER") String deviceType, @Min(1) @Max(4) int relay,
        @NotNull @Pattern(regexp="MANUAL|AUTO") String mode,
        @DecimalMin("-100") @DecimalMax("200") Double temperature1,
        @DecimalMin("-100") @DecimalMax("200") Double temperature3,
        @NotNull @PastOrPresent Instant occurredAt) {}

    public record Event(UUID id, String deviceName, String deviceType, int relay, String mode,
        Double temperature1, Double temperature3, Instant occurredAt, String actor) {}

    private void authorize(Long barnId, Authentication auth) {
        boolean worker = auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_FARM_WORKER"));
        barns.get(barnId, worker ? auth.getName() : null);
    }

    @PostMapping
    public ApiResponse<Void> create(@PathVariable Long barnId, @Valid @RequestBody Activation event, Authentication auth) {
        authorize(barnId, auth);
        jdbc.update("""
            INSERT INTO iot_activation_events
            (id,barn_id,device_name,device_type,relay,mode,temperature1,temperature3,occurred_at,actor)
            VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT (id) DO NOTHING
            """, event.id(), barnId, event.deviceName(), event.deviceType(), event.relay(), event.mode(),
            event.temperature1(), event.temperature3(), Timestamp.from(event.occurredAt()), auth.getName());
        return ApiResponse.success("Đã lưu sự kiện bật thiết bị");
    }

    @GetMapping
    public ApiResponse<List<Event>> list(@PathVariable Long barnId, @RequestParam(defaultValue="0") int page, Authentication auth) {
        authorize(barnId, auth);
        int safePage = Math.max(0, Math.min(page, 100000));
        return ApiResponse.success("Nhật ký bật thiết bị", jdbc.query("""
            SELECT * FROM iot_activation_events WHERE barn_id=?
            ORDER BY occurred_at DESC, id DESC LIMIT 20 OFFSET ?
            """, (rs, row) -> new Event(rs.getObject("id", UUID.class), rs.getString("device_name"),
            rs.getString("device_type"), rs.getInt("relay"), rs.getString("mode"),
            rs.getObject("temperature1", Double.class), rs.getObject("temperature3", Double.class),
            rs.getTimestamp("occurred_at").toInstant(), rs.getString("actor")), barnId, safePage * 20));
    }
}
