package com.farmshift.backendFarmShift.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
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
    private boolean requiresConfirmation;
    private Map<String, Object> pendingAction;
    /** Danh sách phương án gợi ý / xác nhận làm rõ ý định (Disambiguation Options) khi lệnh có thể gây hiểu nhầm hoặc thiếu tham số. */
    private List<Map<String, Object>> clarificationOptions;
    /** Ngữ cảnh ngắn hạn để client gửi lại ở lượt sau (câu kiểu "à nhầm, sửa lại thành 65kg"). */
    private Map<String, Object> actionContext;
}
