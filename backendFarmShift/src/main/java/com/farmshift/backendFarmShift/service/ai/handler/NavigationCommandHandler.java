package com.farmshift.backendFarmShift.service.ai.handler;

import com.farmshift.backendFarmShift.dto.AiAssistantResponse;
import com.farmshift.backendFarmShift.service.AssistantNavigationRouter;
import com.farmshift.backendFarmShift.service.CycleService;
import com.farmshift.backendFarmShift.service.VietnameseSpeechNormalizer;
import com.farmshift.backendFarmShift.service.ai.AiRbacPolicy;
import com.farmshift.backendFarmShift.service.ai.AssistantCommandHandler;
import com.farmshift.backendFarmShift.service.ai.AssistantExecutionContext;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/**
 * Tier 1: Pure Screen Navigation Command Handler (<5ms execution, 0 LLM tokens).
 * Resolves natural language commands like "mở ghi nhật ký", "xem báo cáo", "qua kho hàng".
 */
@Slf4j
@Component
@Order(10)
public class NavigationCommandHandler implements AssistantCommandHandler {

    private static final Set<String> OWNER_ONLY_ROUTES = Set.of(
            "/iot", "/account", "/catalog-settings", "/breeding-settings", "/general-settings"
    );
    private static final Set<String> FINANCE_ROUTES = Set.of(
            "/dashboard", "/inventory", "/purchases", "/sales", "/reports"
    );
    private static final Set<String> FARM_OPS_ROUTES = Set.of(
            "/barns", "/today-tasks", "/journal"
    );

    @Override
    public int getOrder() {
        return 10;
    }

    @Override
    public boolean canHandle(AssistantExecutionContext context) {
        if (Boolean.TRUE.equals(context.getConfirmAction())) {
            return false;
        }
        String norm = VietnameseSpeechNormalizer.removeVietnameseDiacritics(context.getMessage());
        return AssistantNavigationRouter.resolve(norm) != null;
    }

    @Override
    public AiAssistantResponse handle(AssistantExecutionContext context) {
        String norm = VietnameseSpeechNormalizer.removeVietnameseDiacritics(context.getMessage());
        AssistantNavigationRouter.Route route = AssistantNavigationRouter.resolve(norm);
        if (route == null) {
            return null;
        }

        AiAssistantResponse rbacDenied = enforceRouteRbac(route.path(), context);
        if (rbacDenied != null) {
            return rbacDenied;
        }

        Map<String, Object> navSummary = new LinkedHashMap<>();
        navSummary.put("title", "⚡ Điều hướng tức thì (0 tốn token AI)");
        navSummary.put("detail", "Định tuyến cục bộ sang " + route.label() + " (<5ms), bỏ qua hoàn toàn mô hình AI");
        navSummary.put("timestamp", LocalDateTime.now(CycleService.VN_ZONE).toString());

        return AiAssistantResponse.builder()
                .reply("🚀 Đang chuyển bạn sang màn hình **" + route.label() + "** *(điều hướng cục bộ tức thì, 0 tốn token AI)*.")
                .actionType("NAVIGATE_AND_PREFILL")
                .executed(true)
                .navigateTo(route.path())
                .actionSummary(navSummary)
                .build();
    }

    public static AiAssistantResponse enforceRouteRbac(String path, AssistantExecutionContext context) {
        if (path == null || context == null) {
            return null;
        }
        boolean isWorker = context.isWorker() || hasAuthority(context, "ROLE_FARM_WORKER");
        boolean isAccountant = hasAuthority(context, "ROLE_ACCOUNTANT");
        boolean isOwner = !isWorker && !isAccountant
                && (hasAuthority(context, "ROLE_FARM_OWNER") || hasAuthority(context, "ROLE_ADMIN"));

        if (OWNER_ONLY_ROUTES.contains(path)) {
            if (!isOwner) {
                return isWorker
                        ? AiRbacPolicy.createForbiddenResponse()
                        : AiRbacPolicy.createAccountantForbiddenResponse();
            }
            return null;
        }
        if (FINANCE_ROUTES.contains(path)) {
            if (isWorker || (!isOwner && !isAccountant)) {
                return AiRbacPolicy.createForbiddenResponse();
            }
            return null;
        }
        if (FARM_OPS_ROUTES.contains(path)) {
            if (isAccountant || (!isOwner && !isWorker)) {
                return AiRbacPolicy.createAccountantForbiddenResponse();
            }
        }
        return null;
    }

    private static boolean hasAuthority(AssistantExecutionContext context, String expected) {
        if (context.getAuthorities() == null) {
            return false;
        }
        for (GrantedAuthority auth : context.getAuthorities()) {
            if (auth != null && expected.equalsIgnoreCase(auth.getAuthority())) {
                return true;
            }
        }
        return false;
    }
}

