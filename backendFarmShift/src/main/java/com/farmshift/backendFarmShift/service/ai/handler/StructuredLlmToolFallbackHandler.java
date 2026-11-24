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
     * Parses either native OpenAI/Groq `toolCalls` OR raw JSON `content` into a canonical JsonNode
     * aligned with AiAssistantService.executeActionFromLlm().
     */
    public JsonNode extractCanonicalCommandJson(JsonNode rootResponse, ObjectMapper mapper) {
        if (rootResponse == null || mapper == null) {
            return null;
        }
        JsonNode toolCallsNode = rootResponse.has("toolCalls")
                ? rootResponse.path("toolCalls")
                : rootResponse.path("tool_calls");

        if (toolCallsNode != null && toolCallsNode.isArray() && !toolCallsNode.isEmpty()) {
            JsonNode firstCall = toolCallsNode.get(0);
            JsonNode fnNode = firstCall.path("function");
            String toolName = fnNode.path("name").asText(firstCall.path("name").asText("")).trim();
            String mappedIntent = TOOL_NAME_TO_INTENT.getOrDefault(
                    toolName.toLowerCase(Locale.ROOT),
                    toolName.toUpperCase(Locale.ROOT)
            );
            JsonNode rawArgs = fnNode.has("arguments") ? fnNode.get("arguments") : firstCall.get("arguments");
            ObjectNode argsObj;
            if (rawArgs != null && rawArgs.isObject()) {
                argsObj = rawArgs.deepCopy();
            } else if (rawArgs != null && rawArgs.isTextual() && !rawArgs.asText("").isBlank()) {
                try {
                    JsonNode parsedArgs = mapper.readTree(rawArgs.asText());
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
            if (!argsObj.hasNonNull("reply") && argsObj.hasNonNull("adviceSummary")) {
                argsObj.put("reply", argsObj.path("adviceSummary").asText());
            }
            String assistantText = rootResponse.path("content").asText("");
            if (!argsObj.hasNonNull("reply") && !assistantText.isBlank()) {
                argsObj.put("reply", assistantText);
            }
            return normalizeAliases(argsObj);
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
     * Ensures canonical schema fields and legacy aliases are populated consistently in both directions.
     */
    private static ObjectNode normalizeAliases(ObjectNode node) {
        if (node == null) {
            return null;
        }
        // Barn name alias
        if (!hasText(node, "targetBarnName") && hasText(node, "barnName")) {
            node.put("targetBarnName", node.path("barnName").asText());
        } else if (!hasText(node, "barnName") && hasText(node, "targetBarnName")) {
            node.put("barnName", node.path("targetBarnName").asText());
        }
        if (!hasText(node, "reply") && hasText(node, "adviceSummary")) {
            node.put("reply", node.path("adviceSummary").asText());
        }
        // Item / feed name alias
        if (!hasText(node, "itemName") && hasText(node, "feedName")) {
            node.put("itemName", node.path("feedName").asText());
        } else if (!hasText(node, "feedName") && hasText(node, "itemName")) {
            node.put("feedName", node.path("itemName").asText());
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
