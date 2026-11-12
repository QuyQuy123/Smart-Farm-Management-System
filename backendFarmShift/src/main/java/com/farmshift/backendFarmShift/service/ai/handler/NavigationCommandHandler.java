package com.farmshift.backendFarmShift.service.ai.handler;

import com.farmshift.backendFarmShift.dto.AiAssistantResponse;
import com.farmshift.backendFarmShift.service.AssistantNavigationRouter;
import com.farmshift.backendFarmShift.service.VietnameseSpeechNormalizer;
import com.farmshift.backendFarmShift.service.ai.AssistantCommandHandler;
import com.farmshift.backendFarmShift.service.ai.AssistantExecutionContext;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Tier 1: Pure Screen Navigation Command Handler (<5ms execution).
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

        return AiAssistantResponse.builder()
                .reply("🚀 Đang chuyển bạn sang màn hình **" + route.label() + "**.")
                .actionType("NAVIGATE_AND_PREFILL")
                .executed(true)
                .navigateTo(route.path())
                .build();
    }
}

