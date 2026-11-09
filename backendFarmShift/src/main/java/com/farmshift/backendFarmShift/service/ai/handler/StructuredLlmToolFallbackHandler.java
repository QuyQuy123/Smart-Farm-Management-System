package com.farmshift.backendFarmShift.service.ai.handler;

import com.farmshift.backendFarmShift.dto.AiAssistantResponse;
import com.farmshift.backendFarmShift.service.ai.AssistantCommandHandler;
import com.farmshift.backendFarmShift.service.ai.AssistantExecutionContext;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Tier 2c: Structured LLM Tool Fallback Handler (Order: 100).
 * Handles complex veterinary diagnosis, general poultry questions, or open-ended inquiries.
 */
@Slf4j
@Component
@Order(100)
public class StructuredLlmToolFallbackHandler implements AssistantCommandHandler {

    @Override
    public int getOrder() {
        return 100;
    }

    @Override
    public boolean canHandle(AssistantExecutionContext context) {
        // Can handle as fallback if not handled by deterministic or compound handlers
        return true;
    }

    @Override
    public AiAssistantResponse handle(AssistantExecutionContext context) {
        // Returned null so AiAssistantService can execute its existing full evaluateLlmEngine pipeline if needed
        return null;
    }
}

