package com.farmshift.backendFarmShift.service.ai;

import com.farmshift.backendFarmShift.dto.AiAssistantResponse;

/**
 * Common Strategy / Command interface for domain-specific assistant handlers.
 */
public interface AssistantCommandHandler {
    /**
     * Execution order / priority. Lower values are evaluated first.
     * 10: Navigation
     * 20: Compound Journal (Feed, Weight, Mortality)
     * 30: Internal Stock & Batch Price
     * 40: Procurement & Debt
     * 50: IoT Telemetry
     * 100: Structured LLM Fallback
     */
    int getOrder();

    /**
     * Determines whether this handler can process the given user context and intent.
     */
    boolean canHandle(AssistantExecutionContext context);

    /**
     * Executes the domain logic and returns the response.
     */
    AiAssistantResponse handle(AssistantExecutionContext context);
}

