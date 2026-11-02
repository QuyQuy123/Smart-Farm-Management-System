package com.farmshift.backendFarmShift.service.ai;

import com.farmshift.backendFarmShift.dto.AiAssistantResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.List;

@Slf4j
@Component
public class AssistantCommandDispatcher {

    private final List<AssistantCommandHandler> handlers;

    public AssistantCommandDispatcher(List<AssistantCommandHandler> handlers) {
        this.handlers = handlers.stream()
                .sorted(Comparator.comparingInt(AssistantCommandHandler::getOrder))
                .toList();
        log.info("Initialized AssistantCommandDispatcher with {} handlers in order: {}",
                this.handlers.size(),
                this.handlers.stream().map(h -> h.getClass().getSimpleName()).toList());
    }

    public AiAssistantResponse dispatch(AssistantExecutionContext context) {
        for (AssistantCommandHandler handler : handlers) {
            try {
                if (handler.canHandle(context)) {
                    log.debug("Dispatching assistant query to handler: {}", handler.getClass().getSimpleName());
                    AiAssistantResponse response = handler.handle(context);
                    if (response != null) {
                        return response;
                    }
                }
            } catch (Exception ex) {
                log.warn("Error in assistant handler {}: {}", handler.getClass().getSimpleName(), ex.getMessage(), ex);
            }
        }
        return null;
    }
}

