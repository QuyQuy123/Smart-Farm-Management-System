package com.farmshift.backendFarmShift.service.ai.handler;

import com.farmshift.backendFarmShift.dto.AiAssistantResponse;
import com.farmshift.backendFarmShift.service.AssistantNavigationRouter;
import com.farmshift.backendFarmShift.service.VietnameseSpeechNormalizer;
import com.farmshift.backendFarmShift.service.ai.AssistantCommandHandler;
import com.farmshift.backendFarmShift.service.ai.AssistantExecutionContext;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import com.farmshift.backendFarmShift.service.CycleService;

/**
 * Tier 1: Pure Screen Navigation Command Handler (<5ms execution, 0 LLM tokens).
 * Resolves natural language commands like "mở ghi nhật ký", "xem báo cáo", "qua kho hàng".
 */
@Slf4j
@Component
@Order(10)
public class NavigationCommandHandler implements AssistantCommandHandler {

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

        if ("/iot".equals(route.path())) {
            boolean isOwner = context.getAuthorities() == null || context.getAuthorities().isEmpty()
                    || context.getAuthorities().stream().anyMatch(a ->
                            "ROLE_FARM_OWNER".equalsIgnoreCase(a.getAuthority()) || "ROLE_ADMIN".equalsIgnoreCase(a.getAuthority()));
            if (!isOwner) {
                return context.isWorker()
                        ? com.farmshift.backendFarmShift.service.ai.AiRbacPolicy.createForbiddenResponse()
                        : com.farmshift.backendFarmShift.service.ai.AiRbacPolicy.createAccountantForbiddenResponse();
            }
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
}

