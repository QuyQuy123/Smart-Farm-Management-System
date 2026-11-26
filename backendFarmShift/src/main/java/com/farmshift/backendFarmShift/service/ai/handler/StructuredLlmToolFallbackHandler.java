package com.farmshift.backendFarmShift.service.ai.handler;

import com.farmshift.backendFarmShift.dto.AiAssistantResponse;
import com.farmshift.backendFarmShift.service.ai.AiRbacPolicy;
import com.farmshift.backendFarmShift.service.ai.AssistantCommandHandler;
import com.farmshift.backendFarmShift.service.ai.AssistantExecutionContext;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.function.Function;

/**
 * Tier 2c: Structured LLM Native Tool Calling Handler (Order: 100).
 * Defines RBAC-scoped OpenAI/Groq JSON Schema tool definitions (<= 7 params, strict enums),
 * normalizes both native `toolCalls` and JSON `content` payloads into a canonical command node,
 * and handles fallback invocation when deterministic tiers cannot resolve a complex query.
 */
@Slf4j
@Component
@Order(100)
public class StructuredLlmToolFallbackHandler implements AssistantCommandHandler {

    private static final Map<String, String> TOOL_NAME_TO_INTENT = Map.ofEntries(
            // Core 10 LLM-First Tools (Read)
            Map.entry("get_dashboard_summary", "GET_DASHBOARD_SUMMARY"),
            Map.entry("get_barn_status", "GET_BARN_STATUS"),
            Map.entry("get_today_tasks", "GET_TODAY_TASKS"),
            Map.entry("get_inventory_stock", "GET_INVENTORY_STOCK"),
            Map.entry("get_financial_and_debts", "GET_FINANCIAL_AND_DEBTS"),
            Map.entry("search_vet_knowledge", "SEARCH_VET_KNOWLEDGE"),
            // Core 10 LLM-First Tools (Write)
            Map.entry("log_feed_consumption", "LOG_FEED"),
            Map.entry("log_flock_loss", "LOG_MORTALITY"),
            Map.entry("log_weight_sample", "LOG_WEIGHT"),
            Map.entry("complete_daily_task", "COMPLETE_DAILY_TASKS"),
            // Legacy / extended tool aliases
            Map.entry("log_feed", "LOG_FEED"),
            Map.entry("log_weight", "LOG_WEIGHT"),
            Map.entry("log_mortality", "LOG_MORTALITY"),
            Map.entry("complete_daily_tasks", "COMPLETE_DAILY_TASKS"),
            Map.entry("vet_diagnosis", "VET_DIAGNOSIS"),
            Map.entry("navigate_screen", "NAVIGATE_AND_PREFILL"),
            Map.entry("query_farm_status", "QUERY_FARM_STATUS"),
            Map.entry("log_expense", "LOG_EXPENSE"),
            Map.entry("pay_purchase_invoice", "PAY_PURCHASE_INVOICE"),
            Map.entry("cancel_purchase_invoice", "CANCEL_PURCHASE_INVOICE"),
            Map.entry("update_inventory_item", "UPDATE_INVENTORY_ITEM"),
            Map.entry("update_supplier_info", "UPDATE_SUPPLIER_INFO"),
            Map.entry("import_purchase_stock", "IMPORT_PURCHASE_STOCK"),
            Map.entry("update_barn_info", "UPDATE_BARN_INFO")
    );

    private volatile Function<AssistantExecutionContext, AiAssistantResponse> fallbackExecutor;

    public void registerFallbackExecutor(Function<AssistantExecutionContext, AiAssistantResponse> executor) {
        this.fallbackExecutor = executor;
    }

    @Override
    public int getOrder() {
        return 100;
    }

    @Override
    public boolean canHandle(AssistantExecutionContext context) {
        return context != null && context.isLlmFallbackPhase();
    }

    @Override
    public AiAssistantResponse handle(AssistantExecutionContext context) {
        if (context == null) {
            return null;
        }
        if (fallbackExecutor != null) {
            return fallbackExecutor.apply(context);
        }
        return null;
    }

    /**
     * Builds RBAC-filtered OpenAI/Groq JSON Schema tool definitions.
     * ROLE_FARM_WORKER never receives financial or administrative tools.
     * ROLE_ACCOUNTANT never receives barn-ops / direct journal logging tools.
     */
    public List<Map<String, Object>> buildToolSchemas(boolean isWorker, boolean isAccountant) {
        List<Map<String, Object>> tools = new ArrayList<>();
        boolean isOwner = !isWorker && !isAccountant;

        // Shared safe tools (Worker + Owner; Accountant sees read/nav + finance)
        if (!isAccountant || isOwner) {
            tools.add(functionTool(
                    "log_feed",
                    "Ghi nhận khẩu phần cám cho một chuồng nuôi đang hoạt động.",
                    orderedMap(
                            "targetBarnName", prop("string", "Tên chuồng nuôi (ví dụ: Nhà A1, Chuồng B2)"),
                            "itemName", prop("string", "Tên loại cám (ví dụ: Higro 01, CP 511)"),
                            "quantity", prop("number", "Số lượng cám cho ăn (> 0)"),
                            "unit", enumProp("string", "Đơn vị tính", List.of("kg", "bao"))
                    ),
                    List.of("targetBarnName", "quantity", "unit")
            ));

            tools.add(functionTool(
                    "log_weight",
                    "Ghi nhận kết quả cân mẫu trọng lượng bình quân của đàn gà trong chuồng.",
                    orderedMap(
                            "targetBarnName", prop("string", "Tên chuồng nuôi"),
                            "avgWeightKg", prop("number", "Trọng lượng trung bình mỗi con tính bằng kg (> 0)"),
                            "sampleSize", prop("integer", "Số con lấy mẫu cân (> 0)")
                    ),
                    List.of("targetBarnName", "avgWeightKg")
            ));

            tools.add(functionTool(
                    "log_mortality",
                    "Ghi nhận số lượng gà chết hoặc hao hụt trong chuồng nuôi.",
                    orderedMap(
                            "targetBarnName", prop("string", "Tên chuồng nuôi"),
                            "quantity", prop("integer", "Số con gà hao hụt/chết (> 0)"),
                            "reason", prop("string", "Nguyên nhân hao hụt")
                    ),
                    List.of("targetBarnName", "quantity")
            ));

            tools.add(functionTool(
                    "complete_daily_tasks",
                    "Xác nhận hoàn thành công việc hằng ngày tại chuồng nuôi.",
                    orderedMap(
                            "targetBarnName", prop("string", "Tên chuồng nuôi")
                    ),
                    List.of("targetBarnName")
            ));
        }

        tools.add(functionTool(
                "vet_diagnosis",
                "Tư vấn kỹ thuật thú y gia cầm (chỉ cho gà/vịt/gia cầm, tuyệt đối không tư vấn bệnh cho người).",
                orderedMap(
                        "symptoms", prop("string", "Triệu chứng bệnh hoặc câu hỏi thú y gia cầm"),
                        "targetBarnName", prop("string", "Tên chuồng nuôi nếu có"),
                        "adviceSummary", prop("string", "Khuyến cáo chăm sóc, vệ sinh và hướng xử lý tham khảo")
                ),
                List.of("symptoms", "adviceSummary")
        ));

        tools.add(functionTool(
                "query_farm_status",
                "Tra cứu tổng hợp trạng thái chuồng, tồn kho hoặc chỉ số lứa nuôi trong phạm vi quyền hạn.",
                orderedMap(
                        "targetBarnName", prop("string", "Tên chuồng cần tra cứu nếu có"),
                        "itemName", prop("string", "Tên vật tư hoặc chỉ số cần tra cứu"),
                        "reply", prop("string", "Câu trả lời tổng hợp dựa trên dữ liệu thực tế")
                ),
                List.of("reply")
        ));

        List<String> allowedRoutes = isWorker
                ? List.of("/today-tasks", "/journal", "/barns", "/notifications")
                : (isAccountant
                ? List.of("/dashboard", "/inventory", "/internal-stock", "/purchases", "/sales", "/reports")
                : List.of("/dashboard", "/today-tasks", "/journal", "/barns", "/areas", "/inventory", "/internal-stock", "/purchases", "/sales", "/reports", "/iot"));

        tools.add(functionTool(
                "navigate_screen",
                "Điều hướng người dùng tới màn hình nghiệp vụ phù hợp trong phạm vi vai trò.",
                orderedMap(
                        "navigateTo", enumProp("string", "Đường dẫn màn hình đích", allowedRoutes),
                        "reason", prop("string", "Mô tả ngắn gọn màn hình đích")
                ),
                List.of("navigateTo")
        ));

        if (!isWorker) {
            tools.add(functionTool(
                    "log_expense",
                    "Ghi nhận khoản chi phí trực tiếp (thuốc thú y, vắc-xin, vật tư) cho lứa nuôi của chuồng.",
                    orderedMap(
                            "targetBarnName", prop("string", "Tên chuồng nuôi"),
                            "amount", prop("integer", "Số tiền chi phí VNĐ (> 0)"),
                            "expenseCategory", enumProp("string", "Nhóm chi phí hợp lệ", List.of("MEDICINE", "VACCINE", "EQUIPMENT", "OTHER")),
                            "reason", prop("string", "Nội dung khoản chi")
                    ),
                    List.of("targetBarnName", "amount", "expenseCategory")
            ));

            tools.add(functionTool(
                    "pay_purchase_invoice",
                    "Ghi nhận thanh toán công nợ cho hóa đơn nhập hàng (NHxxxxxx).",
                    orderedMap(
                            "targetCode", prop("string", "Mã hóa đơn nhập hàng (ví dụ: NH000003)"),
                            "amount", prop("integer", "Số tiền thanh toán VNĐ (> 0)")
                    ),
                    List.of("targetCode", "amount")
            ));

            tools.add(functionTool(
                    "cancel_purchase_invoice",
                    "Hủy hóa đơn nhập hàng chưa nhập kho và chưa thanh toán.",
                    orderedMap(
                            "targetCode", prop("string", "Mã hóa đơn nhập hàng cần hủy")
                    ),
                    List.of("targetCode")
            ));

            tools.add(functionTool(
                    "import_purchase_stock",
                    "Xác nhận nhập kho hàng hóa từ hóa đơn mua hàng.",
                    orderedMap(
                            "targetCode", prop("string", "Mã hóa đơn nhập hàng (ví dụ: NH000001)")
                    ),
                    List.of("targetCode")
            ));

            tools.add(functionTool(
                    "update_inventory_item",
                    "Cập nhật đơn giá hoặc số lượng tồn kho của một lô vật tư.",
                    orderedMap(
                            "targetEntityId", prop("integer", "ID dòng tồn kho"),
                            "itemName", prop("string", "Tên vật tư"),
                            "fieldToUpdate", enumProp("string", "Trường cần cập nhật", List.of("price", "stock")),
                            "newValue", prop("number", "Giá trị mới")
                    ),
                    List.of("itemName", "fieldToUpdate", "newValue")
            ));

            tools.add(functionTool(
                    "update_supplier_info",
                    "Cập nhật thông tin liên hệ hoặc chính sách thanh toán của nhà cung cấp.",
                    orderedMap(
                            "targetEntityId", prop("integer", "ID nhà cung cấp"),
                            "supplierName", prop("string", "Tên nhà cung cấp nếu không có ID"),
                            "fieldToUpdate", enumProp("string", "Trường cần cập nhật", List.of("phone", "paymentPolicy", "address", "representative")),
                            "newValue", prop("string", "Giá trị mới")
                    ),
                    List.of("fieldToUpdate", "newValue")
            ));
        }

        if (isOwner) {
            tools.add(functionTool(
                    "update_barn_info",
                    "Cập nhật sức chứa, diện tích hoặc tên chuồng nuôi.",
                    orderedMap(
                            "targetBarnName", prop("string", "Tên chuồng nuôi"),
                            "fieldToUpdate", enumProp("string", "Trường cần cập nhật", List.of("capacity", "areaM2", "name")),
                            "newValue", prop("string", "Giá trị mới")
                    ),
                    List.of("targetBarnName", "fieldToUpdate", "newValue")
            ));
        }

        return List.copyOf(tools);
    }

    /**
     * Builds the lean 10 Core Tools (OpenAI/Groq JSON Schema) for LLM-First Tool Calling,
     * filtered strictly by RBAC role (ROLE_FARM_WORKER never receives financial tools;
     * ROLE_ACCOUNTANT never receives barn-ops write tools).
     */
    public List<Map<String, Object>> buildCoreLlmFirstToolSchemas(boolean isWorker, boolean isAccountant) {
        List<Map<String, Object>> tools = new ArrayList<>();

        // Group A: Read-Only Tools (Auto-executed against PostgreSQL with RBAC filtering)
        tools.add(coreFunctionTool(
                "get_dashboard_summary",
                "Lấy bản tin tổng quan trang trại hôm nay: tổng đàn, hao hụt, việc quá giờ, cảnh báo FCR, tồn kho thấp, công nợ (ẩn tiền & công nợ với Công nhân). Gọi khi user hỏi 'hôm nay có gì mới', 'tình hình trại', 'có biến gì không', 'báo cáo nhanh', 'cần xử lý gì trước'.",
                orderedMap(
                        "date", prop("string", "Ngày cần xem định dạng YYYY-MM-DD (tùy chọn, mặc định hôm nay)")
                ),
                List.of()
        ));

        tools.add(coreFunctionTool(
                "get_barn_status",
                "Xem chi tiết tình trạng 1 chuồng hoặc tất cả chuồng: số con, ngày tuổi, cân mẫu gần nhất, FCR, tỷ lệ hao hụt, nhiệt độ mục tiêu. Gọi khi hỏi 'nhà B2 sao rồi', 'chuồng nào đang toang FCR nhất', 'chuồng nào hao hụt cao nhất'.",
                orderedMap(
                        "barn_name", prop("string", "Tên chuồng cần xem (tùy chọn, bỏ trống để xem tất cả chuồng)"),
                        "sort_by", enumProp("string", "Sắp xếp danh sách chuồng giảm dần theo chỉ số", List.of("fcr", "mortality", "age"))
                ),
                List.of()
        ));

        tools.add(coreFunctionTool(
                "get_today_tasks",
                "Lấy danh sách việc hôm nay (cữ cám, vắc-xin, thuốc, việc giao thêm), lọc theo trạng thái chưa làm / quá giờ / đã xong.",
                orderedMap(
                        "barn_name", prop("string", "Tên chuồng cần lọc (tùy chọn)"),
                        "status", enumProp("string", "Trạng thái công việc cần lọc", List.of("pending", "overdue", "done", "all")),
                        "date", prop("string", "Ngày YYYY-MM-DD (tùy chọn, mặc định hôm nay)")
                ),
                List.of()
        ));

        tools.add(coreFunctionTool(
                "get_inventory_stock",
                "Kiểm tra tồn kho cám, thuốc, vắc-xin theo kho hoặc sản phẩm, lọc hàng sắp cạn (ẩn giá vốn với Công nhân).",
                orderedMap(
                        "product_name", prop("string", "Tên sản phẩm / loại cám / thuốc (tùy chọn)"),
                        "warehouse_name", prop("string", "Tên kho cần lọc (tùy chọn)"),
                        "low_stock_only", prop("boolean", "True nếu chỉ lấy mặt hàng sắp cạn / tồn thấp")
                ),
                List.of()
        ));

        if (!isWorker) {
            tools.add(coreFunctionTool(
                    "get_financial_and_debts",
                    "Tra cứu công nợ nhà cung cấp (nợ NCC nào nhiều nhất), công nợ khách hàng, hóa đơn quá hạn, doanh thu và lãi/lỗ P&L trang trại theo toàn kỳ hoặc khoảng ngày. Dành cho Chủ trại và Kế toán.",
                    orderedMap(
                            "scope", enumProp("string", "Phạm vi tra cứu tài chính / công nợ", List.of("supplier_debt", "customer_debt", "pnl", "summary")),
                            "partner_name", prop("string", "Tên nhà cung cấp hoặc khách hàng cụ thể (tùy chọn)"),
                            "from_date", prop("string", "Ngày bắt đầu lọc P&L định dạng YYYY-MM-DD (tùy chọn)"),
                            "to_date", prop("string", "Ngày kết thúc lọc P&L định dạng YYYY-MM-DD (tùy chọn)")
                    ),
                    List.of("scope")
            ));
        }

        tools.add(coreFunctionTool(
                "search_vet_knowledge",
                "Tra cứu phác đồ thú y, bệnh gia cầm (khò khè, vẩy mỏ, CRD, ORT, Coryza, cầu trùng, Gumboro, Newcastle), lịch vắc-xin, kỹ thuật úm trong kho tài liệu RAG nội bộ của trại trước khi tư vấn.",
                orderedMap(
                        "query", prop("string", "Triệu chứng, tên bệnh, độ tuổi gà hoặc kỹ thuật chăn nuôi cần tra cứu")
                ),
                List.of("query")
        ));

        // Group B: Write Tools (Always produce signed 2-step HITL confirmation cards)
        if (!isAccountant) {
            tools.add(coreFunctionTool(
                    "log_feed_consumption",
                    "Ghi nhận cho chuồng ăn cám (tự quy đổi 1 bao = 25 kg). Chỉ cần barn_name, quantity và unit là gọi tool NGAY; feed_name là TÙY CHỌN (tuyệt đối KHÔNG hỏi lại tên loại cám nếu người dùng không nêu, hệ thống tự chọn theo chương trình nuôi). Chỉ hỏi lại khi thiếu chuồng hoặc số lượng.",
                    orderedMap(
                            "barn_name", prop("string", "Tên chuồng nuôi (VD: Nhà A1, Nhà B2)"),
                            "quantity", prop("number", "Số lượng cám (> 0)"),
                            "unit", enumProp("string", "Đơn vị tính", List.of("kg", "bao")),
                            "feed_name", prop("string", "Tên loại cám nếu người dùng nêu rõ (tùy chọn, bỏ trống để hệ thống tự lấy theo chương trình nuôi)")
                    ),
                    List.of("barn_name", "quantity", "unit")
            ));

            tools.add(coreFunctionTool(
                    "log_flock_loss",
                    "Báo cáo gà chết (DEATH) hoặc loại thải (CULL) tại một chuồng nuôi.",
                    orderedMap(
                            "barn_name", prop("string", "Tên chuồng nuôi"),
                            "quantity", prop("integer", "Số con gà chết hoặc loại thải (> 0)"),
                            "loss_type", enumProp("string", "Loại hao hụt", List.of("DEATH", "CULL")),
                            "reason", prop("string", "Nguyên nhân hao hụt")
                    ),
                    List.of("barn_name", "quantity", "loss_type", "reason")
            ));

            tools.add(coreFunctionTool(
                    "log_weight_sample",
                    "Ghi nhận kết quả cân mẫu định kỳ của chuồng nuôi.",
                    orderedMap(
                            "barn_name", prop("string", "Tên chuồng nuôi"),
                            "avg_weight_kg", prop("number", "Trọng lượng trung bình mỗi con tính bằng kg (> 0)"),
                            "sample_size", prop("integer", "Số con lấy mẫu cân (mặc định 50 nếu không nêu)")
                    ),
                    List.of("barn_name", "avg_weight_kg")
            ));

            tools.add(coreFunctionTool(
                    "complete_daily_task",
                    "Xác nhận hoàn thành một phiếu việc hôm nay hoặc công việc được giao tại chuồng nuôi.",
                    orderedMap(
                            "barn_name", prop("string", "Tên chuồng nuôi"),
                            "task_description", prop("string", "Mô tả công việc cần hoàn thành")
                    ),
                    List.of("barn_name", "task_description")
            ));
        }

        return List.copyOf(tools);
    }

    /**
     * Parses ALL native OpenAI/Groq `toolCalls` emitted in a single LLM response (supports parallel tool calls).
     */
    public List<JsonNode> extractAllNativeToolCalls(JsonNode rootResponse, ObjectMapper mapper) {
        if (rootResponse == null || mapper == null) {
            return List.of();
        }
        JsonNode toolCallsNode = rootResponse.has("toolCalls")
                ? rootResponse.path("toolCalls")
                : rootResponse.path("tool_calls");
        if (toolCallsNode == null || !toolCallsNode.isArray() || toolCallsNode.isEmpty()) {
            return List.of();
        }
        String assistantText = rootResponse.path("content").asText("");
        List<JsonNode> results = new ArrayList<>();
        for (int i = 0; i < toolCallsNode.size(); i++) {
            JsonNode callNode = toolCallsNode.get(i);
            JsonNode parsedCall = parseSingleNativeToolCall(callNode, i + 1, assistantText, mapper);
            if (parsedCall != null) {
                results.add(parsedCall);
            }
        }
        return results;
    }

    private JsonNode parseSingleNativeToolCall(
            JsonNode callNode,
            int index,
            String assistantText,
            ObjectMapper mapper
    ) {
        if (callNode == null || !callNode.isObject()) {
            return null;
        }
        JsonNode fnNode = callNode.path("function");
        String toolCallId = callNode.path("id").asText("call_" + index).trim();
        String toolName = fnNode.path("name").asText(callNode.path("name").asText("")).trim();
        if (toolName.isBlank()) {
            return null;
        }
        String mappedIntent = TOOL_NAME_TO_INTENT.getOrDefault(
                toolName.toLowerCase(Locale.ROOT),
                toolName.toUpperCase(Locale.ROOT)
        );
        JsonNode rawArgs = fnNode.has("arguments") ? fnNode.get("arguments") : callNode.get("arguments");
        String rawArgsStr = "{}";
        ObjectNode argsObj;
        if (rawArgs != null && rawArgs.isObject()) {
            argsObj = rawArgs.deepCopy();
            rawArgsStr = rawArgs.toString();
        } else if (rawArgs != null && rawArgs.isTextual() && !rawArgs.asText("").isBlank()) {
            rawArgsStr = rawArgs.asText();
            try {
                JsonNode parsedArgs = mapper.readTree(rawArgsStr);
                argsObj = parsedArgs.isObject() ? (ObjectNode) parsedArgs : mapper.createObjectNode();
            } catch (Exception ex) {
                log.warn("Malformed native tool_call arguments for tool={}: {}", toolName, ex.getMessage());
                argsObj = mapper.createObjectNode();
            }
        } else {
            argsObj = mapper.createObjectNode();
        }
        argsObj.put("intent", mappedIntent);
        argsObj.put("_source", "NATIVE_TOOL_CALL");
        argsObj.put("_toolCallId", toolCallId);
        argsObj.put("_rawToolName", toolName);
        argsObj.put("_rawArguments", rawArgsStr);
        if (!argsObj.hasNonNull("reply") && argsObj.hasNonNull("adviceSummary")) {
            argsObj.put("reply", argsObj.path("adviceSummary").asText());
        }
        if (!argsObj.hasNonNull("reply") && assistantText != null && !assistantText.isBlank()) {
            argsObj.put("reply", assistantText);
        }
        return normalizeAliases(argsObj);
    }

    /**
     * Parses either native OpenAI/Groq `toolCalls` OR raw JSON `content` into a canonical JsonNode
     * aligned with AiAssistantService.executeActionFromLlm().
     */
    public JsonNode extractCanonicalCommandJson(JsonNode rootResponse, ObjectMapper mapper) {
        if (rootResponse == null || mapper == null) {
            return null;
        }
        List<JsonNode> nativeCalls = extractAllNativeToolCalls(rootResponse, mapper);
        if (!nativeCalls.isEmpty()) {
            return nativeCalls.get(0);
        }

        String content = rootResponse.has("content")
                ? rootResponse.path("content").asText("")
                : rootResponse.path("choices").path(0).path("message").path("content").asText("");
        if (content == null || content.isBlank()) {
            return null;
        }
        String stripped = stripMarkdownCodeFences(content);
        try {
            JsonNode parsed = mapper.readTree(stripped);
            if (parsed.isObject()) {
                ObjectNode obj = (ObjectNode) parsed;
                obj.put("_source", "JSON_CONTENT");
                return normalizeAliases(obj);
            }
            return parsed;
        } catch (Exception ex) {
            ObjectNode fallbackQna = mapper.createObjectNode();
            fallbackQna.put("intent", "GENERAL_QNA");
            fallbackQna.put("reply", content.trim());
            fallbackQna.put("_source", "TEXT_CONTENT");
            return fallbackQna;
        }
    }

    /**
     * Ensures canonical schema fields and legacy/snake_case aliases are populated consistently in both directions.
     */
    private static ObjectNode normalizeAliases(ObjectNode node) {
        if (node == null) {
            return null;
        }
        // Barn name alias (barn_name <-> targetBarnName <-> barnName)
        if (!hasText(node, "targetBarnName") && hasText(node, "barn_name")) {
            node.put("targetBarnName", node.path("barn_name").asText());
        }
        if (!hasText(node, "targetBarnName") && hasText(node, "barnName")) {
            node.put("targetBarnName", node.path("barnName").asText());
        } else if (!hasText(node, "barnName") && hasText(node, "targetBarnName")) {
            node.put("barnName", node.path("targetBarnName").asText());
        }
        if (!hasText(node, "reply") && hasText(node, "adviceSummary")) {
            node.put("reply", node.path("adviceSummary").asText());
        }
        // Item / feed name alias (feed_name / product_name <-> itemName <-> feedName)
        if (!hasText(node, "itemName") && hasText(node, "feed_name")) {
            node.put("itemName", node.path("feed_name").asText());
        }
        if (!hasText(node, "itemName") && hasText(node, "product_name")) {
            node.put("itemName", node.path("product_name").asText());
        }
        if (!hasText(node, "itemName") && hasText(node, "feedName")) {
            node.put("itemName", node.path("feedName").asText());
        } else if (!hasText(node, "feedName") && hasText(node, "itemName")) {
            node.put("feedName", node.path("itemName").asText());
        }
        // Weight / sample size / loss type / task description snake_case aliases
        if (!node.hasNonNull("avgWeightKg") && node.hasNonNull("avg_weight_kg") && node.path("avg_weight_kg").isNumber()) {
            node.put("avgWeightKg", node.path("avg_weight_kg").asDouble());
        }
        if (!node.hasNonNull("sampleSize") && node.hasNonNull("sample_size") && node.path("sample_size").isNumber()) {
            node.put("sampleSize", node.path("sample_size").asInt());
        }
        if (!hasText(node, "lossType") && hasText(node, "loss_type")) {
            node.put("lossType", node.path("loss_type").asText());
        }
        if (!hasText(node, "taskDescription") && hasText(node, "task_description")) {
            node.put("taskDescription", node.path("task_description").asText());
        }
        // Invoice code alias
        if (!hasText(node, "targetCode") && hasText(node, "invoiceCode")) {
            node.put("targetCode", node.path("invoiceCode").asText());
        } else if (!hasText(node, "invoiceCode") && hasText(node, "targetCode")) {
            node.put("invoiceCode", node.path("targetCode").asText());
        }
        String intent = node.path("intent").asText("").toUpperCase(Locale.ROOT);
        if ("LOG_FEED".equals(intent)) {
            if (!node.hasNonNull("feedKg") && node.hasNonNull("quantity") && node.path("quantity").isNumber()) {
                double q = node.path("quantity").asDouble();
                String unit = node.path("unit").asText("kg").trim().toLowerCase(Locale.ROOT);
                double kg = "bao".equals(unit) ? q * 25.0 : q;
                node.put("feedKg", kg);
            }
        } else if ("LOG_MORTALITY".equals(intent)) {
            if (!node.hasNonNull("mortalityQty") && node.hasNonNull("quantity") && node.path("quantity").isNumber()) {
                node.put("mortalityQty", node.path("quantity").asInt());
            }
        } else if ("LOG_EXPENSE".equals(intent)) {
            if (!node.hasNonNull("expenseAmount") && node.hasNonNull("amount") && node.path("amount").isNumber()) {
                node.put("expenseAmount", node.path("amount").asLong());
            }
        }
        return node;
    }

    private static boolean hasText(JsonNode node, String field) {
        return node.hasNonNull(field) && !node.path(field).asText("").isBlank()
                && !"null".equalsIgnoreCase(node.path(field).asText(""));
    }

    private static String stripMarkdownCodeFences(String raw) {
        String s = raw.trim();
        if (s.startsWith("```")) {
            s = s.replaceFirst("^```(?:json)?\\s*", "");
            if (s.endsWith("```")) {
                s = s.substring(0, s.length() - 3);
            }
        }
        return s.trim();
    }

    public static boolean isToolAllowedForRole(boolean isWorker, boolean isAccountant, String intent) {
        if (isWorker) {
            return AiRbacPolicy.isAllowed(true, intent);
        }
        if (isAccountant) {
            return AiRbacPolicy.isAllowedForRole("ROLE_ACCOUNTANT", intent);
        }
        return true;
    }

    private static Map<String, Object> coreFunctionTool(
            String name,
            String description,
            Map<String, Object> properties,
            List<String> required
    ) {
        Map<String, Object> parameters = new LinkedHashMap<>();
        parameters.put("type", "object");
        parameters.put("properties", properties);
        parameters.put("required", required);

        Map<String, Object> fn = new LinkedHashMap<>();
        fn.put("name", name);
        fn.put("description", description);
        fn.put("parameters", parameters);

        Map<String, Object> tool = new LinkedHashMap<>();
        tool.put("type", "function");
        tool.put("function", fn);
        return tool;
    }

    private static Map<String, Object> functionTool(
            String name,
            String description,
            Map<String, Object> properties,
            List<String> required
    ) {
        Map<String, Object> parameters = new LinkedHashMap<>();
        parameters.put("type", "object");
        parameters.put("properties", properties);
        parameters.put("required", required);
        parameters.put("additionalProperties", false);

        Map<String, Object> fn = new LinkedHashMap<>();
        fn.put("name", name);
        fn.put("description", description);
        fn.put("parameters", parameters);

        Map<String, Object> tool = new LinkedHashMap<>();
        tool.put("type", "function");
        tool.put("function", fn);
        return tool;
    }

    private static Map<String, Object> prop(String type, String description) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("type", type);
        map.put("description", description);
        return map;
    }

    private static Map<String, Object> enumProp(String type, String description, List<String> allowed) {
        Map<String, Object> map = prop(type, description);
        map.put("enum", allowed);
        return map;
    }

    private static Map<String, Object> orderedMap(Object... kv) {
        Map<String, Object> map = new LinkedHashMap<>();
        for (int i = 0; i + 1 < kv.length; i += 2) {
            map.put(String.valueOf(kv[i]), kv[i + 1]);
        }
        return map;
    }
}
