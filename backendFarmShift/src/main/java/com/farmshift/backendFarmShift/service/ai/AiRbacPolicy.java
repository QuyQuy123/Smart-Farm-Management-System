package com.farmshift.backendFarmShift.service.ai;

import com.farmshift.backendFarmShift.dto.AiAssistantResponse;

import java.util.Set;

/**
 * Enforces Role-Based Access Control (RBAC) policies across AI actions.
 * Protects financial records, prices, and entity deletions from unauthorized roles.
 */
public final class AiRbacPolicy {

    public static final String MSG60 = "Tài khoản Công nhân không có quyền thực hiện thao tác tài chính hoặc xóa dữ liệu này.";

    private static final Set<String> FORBIDDEN_FOR_WORKER = Set.of(
            "LOG_EXPENSE",
            "UPDATE_CYCLE_EXPENSE",
            "DELETE_CYCLE_EXPENSE",
            "PAY_PURCHASE_DEBT",
            "UPDATE_INVENTORY_PRICE",
            "CREATE_BARN",
            "DELETE_BARN",
            "UPDATE_BARN_CAPACITY",
            "INTERNAL_STOCK_IMPORT_OPENING",
            "INTERNAL_STOCK_DISPOSAL",
            "CLOSE_CYCLE"
    );

    private AiRbacPolicy() {
    }

    public static boolean isAllowed(boolean isWorker, String actionType) {
        if (!isWorker) {
            return true;
        }
        if (actionType == null) {
            return true;
        }
        return !FORBIDDEN_FOR_WORKER.contains(actionType.toUpperCase());
    }

    public static AiAssistantResponse createForbiddenResponse() {
        return AiAssistantResponse.builder()
                .reply(MSG60)
                .actionType("RBAC_BLOCKED")
                .executed(false)
                .build();
    }
}

