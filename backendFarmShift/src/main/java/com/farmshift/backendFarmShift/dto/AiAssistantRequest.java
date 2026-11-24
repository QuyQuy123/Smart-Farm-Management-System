package com.farmshift.backendFarmShift.dto;

import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiAssistantRequest {
    @Size(max = 4000, message = "Tin nhắn tối đa 4000 ký tự.")
    private String message;
    @Size(max = 256, message = "Đường dẫn hiện tại quá dài.")
    private String currentRoute;
    @Builder.Default
    private Boolean autoExecute = false;
    @Builder.Default
    private Boolean confirmAction = false;
    private java.util.Map<String, Object> pendingActionPayload;
    @Size(max = 128)
    private String actionId;
    @Size(max = 512)
    private String actionToken;
    @Size(max = 128)
    private String sessionId;
    @Builder.Default
    private Boolean resetSession = false;
    @Builder.Default
    @Size(max = 40, message = "Lịch sử hội thoại tối đa 40 lượt.")
    private java.util.List<java.util.Map<String, String>> history = new java.util.ArrayList<>();
    /** Ngữ cảnh thao tác vừa thực hiện (lastIntent, lastBarnId, lastBarnName, lastEntityId, lastItemName, lastInvoiceCode) để hiểu câu sửa sai nối tiếp. */
    private java.util.Map<String, Object> lastActionContext;
}
