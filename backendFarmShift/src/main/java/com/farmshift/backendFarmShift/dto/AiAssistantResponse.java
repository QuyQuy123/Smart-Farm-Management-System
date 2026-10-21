package com.farmshift.backendFarmShift.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AiAssistantResponse {
    private String reply;
    private String actionType;
    private boolean executed;
    private String navigateTo;
    private String uiCommand;
    private Map<String, Object> actionSummary;
    private Map<String, Object> prefillData;
    private Map<String, Object> dataCard;
}
