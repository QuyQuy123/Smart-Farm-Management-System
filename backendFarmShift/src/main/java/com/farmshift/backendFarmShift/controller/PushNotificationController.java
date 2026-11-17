package com.farmshift.backendFarmShift.controller;

import com.farmshift.backendFarmShift.dto.request.PushIotAlertRequest;
import com.farmshift.backendFarmShift.dto.request.PushSubscribeRequest;
import com.farmshift.backendFarmShift.dto.request.PushTestRequest;
import com.farmshift.backendFarmShift.dto.request.PushUnsubscribeRequest;
import com.farmshift.backendFarmShift.entity.Barn;
import com.farmshift.backendFarmShift.entity.PushSubscription;
import com.farmshift.backendFarmShift.exception.ResourceNotFoundException;
import com.farmshift.backendFarmShift.repository.BarnRepository;
import com.farmshift.backendFarmShift.security.RoleNames;
import com.farmshift.backendFarmShift.service.BarnResponsibilityService;
import com.farmshift.backendFarmShift.service.WebPushService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/push")
@RequiredArgsConstructor
public class PushNotificationController {

    private final WebPushService webPushService;
    private final BarnRepository barnRepository;
    private final BarnResponsibilityService barnResponsibilityService;

    @GetMapping("/vapid-public-key")
    public Map<String, String> getVapidPublicKey() {
        return Map.of("publicKey", webPushService.getVapidPublicKey());
    }

    @PostMapping("/subscribe")
    public Map<String, Object> subscribe(
            @Valid @RequestBody PushSubscribeRequest request,
            Authentication authentication
    ) {
        PushSubscription saved = webPushService.subscribe(authentication.getName(), request);
        return Map.of("subscribed", true, "id", saved.getId());
    }

    @PostMapping("/unsubscribe")
    public Map<String, Object> unsubscribe(
            @Valid @RequestBody PushUnsubscribeRequest request,
            Authentication authentication
    ) {
        webPushService.unsubscribe(authentication.getName(), request.endpoint());
        return Map.of("subscribed", false);
    }

    @GetMapping("/status")
    public WebPushService.StatusResult status(Authentication authentication) {
        return webPushService.status(authentication.getName());
    }

    @PostMapping("/test")
    public WebPushService.TestPushResult test(
            @Valid @RequestBody(required = false) PushTestRequest request,
            Authentication authentication
    ) {
        return webPushService.sendTestNotification(authentication.getName(), request);
    }

    @PostMapping("/iot-alert")
    public Map<String, Object> triggerIotAlert(
            @Valid @RequestBody PushIotAlertRequest request,
            Authentication authentication
    ) {
        boolean isOwner = hasAuthority(authentication, RoleNames.FARM_OWNER);
        boolean isWorker = hasAuthority(authentication, RoleNames.FARM_WORKER);
        if (!isOwner && !(isWorker && barnResponsibilityService.isWorkerOfBarn(authentication.getName(), request.barnId()))) {
            throw new AccessDeniedException("Bạn không có quyền gửi cảnh báo cho chuồng này.");
        }

        Barn barn = barnRepository.findById(request.barnId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy chuồng."));
        String severity = request.severity() != null && !request.severity().isBlank() ? request.severity().trim() : "CRITICAL";
        webPushService.sendIoTAlertToAuthorizedUsers(
                barn,
                request.title().trim(),
                request.body().trim(),
                severity,
                "/iot?barn=" + barn.getId()
        );
        return Map.of("dispatched", true, "barnId", barn.getId());
    }

    private static boolean hasAuthority(Authentication auth, String role) {
        return auth != null && auth.getAuthorities() != null
                && auth.getAuthorities().stream().anyMatch(a -> role.equals(a.getAuthority()));
    }
}
