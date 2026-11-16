package com.farmshift.backendFarmShift.config;

import com.farmshift.backendFarmShift.service.RealtimeSyncService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.Set;

/**
 * Emits a lightweight STOMP sync signal after any successful domain write operation completes.
 */
@Component
@RequiredArgsConstructor
public class RealtimeSyncInterceptor implements HandlerInterceptor {

    private static final Set<String> MUTATING_METHODS = Set.of("POST", "PUT", "PATCH", "DELETE");

    private final RealtimeSyncService realtimeSyncService;

    @Override
    public void afterCompletion(
            HttpServletRequest request,
            HttpServletResponse response,
            Object handler,
            Exception ex
    ) {
        if (ex != null || response == null) {
            return;
        }
        int status = response.getStatus();
        if (status < 200 || status >= 300) {
            return;
        }
        String method = request.getMethod();
        if (method == null || !MUTATING_METHODS.contains(method.toUpperCase())) {
            return;
        }
        String path = resolvePath(request);
        if (shouldSkipBroadcast(path)) {
            return;
        }
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String actor = auth != null ? auth.getName() : null;
        String originClientId = request.getHeader("X-Client-Id");
        realtimeSyncService.broadcastDataChange(path, method, actor, originClientId);
    }

    private static boolean shouldSkipBroadcast(String path) {
        if (path == null || !path.startsWith("/api/")) {
            return true;
        }
        return path.startsWith("/api/auth/")
                || path.startsWith("/api/ai/")
                || path.startsWith("/api/voice/")
                || path.startsWith("/api/files/")
                || path.startsWith("/api/phone-camera/")
                || path.startsWith("/api/ws");
    }

    private static String resolvePath(HttpServletRequest request) {
        String uri = request.getRequestURI();
        String ctx = request.getContextPath();
        if (uri == null) {
            return "/";
        }
        if (ctx != null && !ctx.isEmpty() && uri.startsWith(ctx)) {
            return uri.substring(ctx.length());
        }
        return uri;
    }
}
