package com.farmshift.backendFarmShift.controller;

import com.farmshift.backendFarmShift.dto.response.ApiResponse;
import com.farmshift.backendFarmShift.service.BarnService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/barns/{barnId}/camera")
@RequiredArgsConstructor
public class BarnCameraController {
    private final JdbcTemplate jdbc;
    private final BarnService barns;
    public record Camera(@NotBlank @Pattern(regexp="[A-Za-z0-9_-]{1,100}") String streamPath) {}
    private void authorize(Long barnId, Authentication auth) {
        boolean worker = auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_FARM_WORKER"));
        barns.get(barnId, worker ? auth.getName() : null);
    }
    @GetMapping
    public ApiResponse<Camera> get(@PathVariable("barnId") Long barnId, Authentication auth) {
        authorize(barnId, auth);
        var cameras = jdbc.query("SELECT stream_path FROM barn_cameras WHERE barn_id=?",
            (rs, row) -> new Camera(rs.getString(1)), barnId);
        return ApiResponse.success("Camera chuồng", cameras.isEmpty() ? null : cameras.getFirst());
    }
    @PutMapping
    @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<Camera> save(@PathVariable("barnId") Long barnId, @Valid @RequestBody Camera camera, Authentication auth) {
        authorize(barnId, auth);
        jdbc.update("INSERT INTO barn_cameras(barn_id,stream_path) VALUES (?,?) ON CONFLICT (barn_id) DO UPDATE SET stream_path=EXCLUDED.stream_path", barnId, camera.streamPath());
        return ApiResponse.success("Đã lưu camera", camera);
    }
}
