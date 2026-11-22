package com.farmshift.backendFarmShift.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiAssistantRequest {
    private String message;
    private String currentRoute;
    @Builder.Default
    private Boolean autoExecute = false;
    @Builder.Default
    private Boolean confirmAction = false;
    private java.util.Map<String, Object> pendingActionPayload;
    private String actionId;
    private String actionToken;
    private String sessionId;
    @Builder.Default
    private Boolean resetSession = false;
    @Builder.Default
    private java.util.List<java.util.Map<String, String>> history = new java.util.ArrayList<>();
    /** Ngữ cảnh thao tác vừa thực hiện (lastIntent, lastBarnId, lastBarnName, lastEntityId, lastItemName, lastInvoiceCode) để hiểu câu sửa sai nối tiếp. */
    private java.util.Map<String, Object> lastActionContext;
}
