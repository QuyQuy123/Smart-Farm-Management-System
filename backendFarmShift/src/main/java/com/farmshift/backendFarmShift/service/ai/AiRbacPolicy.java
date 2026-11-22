package com.farmshift.backendFarmShift.service.ai;

import com.farmshift.backendFarmShift.dto.AiAssistantResponse;

import java.util.Set;

/**
 * Enforces Role-Based Access Control (RBAC) policies across AI actions.
 * Protects financial records, prices, and entity deletions from unauthorized roles.
 */
public final class AiRbacPolicy {

    public static final String MSG60 = "Tài khoản Công nhân không có quyền thực hiện thao tác tài chính hoặc xóa dữ liệu này.";
    public static final String MSG_ACCOUNTANT_FORBIDDEN = "Tài khoản Kế toán không có quyền quản trị tài khoản nhân sự, thay đổi cấu hình hệ thống, quản trị chuồng trại/lứa nuôi hoặc ghi nhật ký trực tiếp này. Vui lòng liên hệ Chủ trang trại.";

    private static final Set<String> FORBIDDEN_FOR_WORKER = Set.of(
            "LOG_EXPENSE",
            "LOG_OR_UPDATE_EXPENSE",
            "UPDATE_CYCLE_EXPENSE",
            "UPDATE_EXPENSE",
            "DELETE_CYCLE_EXPENSE",
            "PAY_PURCHASE_DEBT",
            "PAY_PURCHASE_INVOICE",
            "CANCEL_PURCHASE_INVOICE",
            "UPDATE_INVENTORY_PRICE",
            "UPDATE_INVENTORY_ITEM",
            "UPDATE_SUPPLIER_INFO",
            "CREATE_SUPPLIER",
            "CREATE_BARN",
            "CREATE_BARN_OR_AREA",
            "CREATE_AREA",
            "DELETE_BARN",
            "UPDATE_BARN_CAPACITY",
            "UPDATE_BARN_INFO",
            "INTERNAL_STOCK_IMPORT_OPENING",
            "INTERNAL_STOCK_DISPOSAL",
            "START_CYCLE",
            "CLOSE_CYCLE",
            "START_OR_CLOSE_CYCLE",
            "TRANSFER_FLOCK",
            "IMPORT_PURCHASE_STOCK",
            "INTERNAL_STOCK_VOUCHER",
            "CREATE_INTERNAL_VOUCHER",
            "HARVEST_FLOCK",
            "HARVEST",
            "DELETE_ACCOUNT",
            "MANAGE_ACCOUNT",
            "UPDATE_SYSTEM_SETTINGS"
    );

    private static final Set<String> FORBIDDEN_FOR_ACCOUNTANT = Set.of(
            "CREATE_BARN",
            "CREATE_BARN_OR_AREA",
            "CREATE_AREA",
            "DELETE_BARN",
            "UPDATE_BARN_CAPACITY",
            "UPDATE_BARN_INFO",
            "START_CYCLE",
            "CLOSE_CYCLE",
            "START_OR_CLOSE_CYCLE",
            "TRANSFER_FLOCK",
            "COMPLETE_DAILY_TASKS",
            "LOG_FEED",
            "COMPOUND_LOG_FEED",
            "UPDATE_FEED",
            "LOG_OR_UPDATE_FEED",
            "LOG_WEIGHT",
            "COMPOUND_LOG_WEIGHT",
            "UPDATE_WEIGHT",
            "LOG_OR_UPDATE_WEIGHT",
            "LOG_MORTALITY",
            "COMPOUND_LOG_MORTALITY",
            "UPDATE_MORTALITY",
            "LOG_OR_UPDATE_MORTALITY",
            "DELETE_ACCOUNT",
            "MANAGE_ACCOUNT",
            "UPDATE_SYSTEM_SETTINGS"
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

    public static boolean isAllowedForRole(String role, String actionType) {
        if (actionType == null) {
            return true;
        }
        String upperAction = actionType.toUpperCase();
        if ("ROLE_FARM_WORKER".equalsIgnoreCase(role)) {
            return !FORBIDDEN_FOR_WORKER.contains(upperAction);
        }
        if ("ROLE_ACCOUNTANT".equalsIgnoreCase(role)) {
            return !FORBIDDEN_FOR_ACCOUNTANT.contains(upperAction);
        }
        return true;
    }

    public static AiAssistantResponse createForbiddenResponse() {
        return AiAssistantResponse.builder()
                .reply(MSG60)
                .actionType("RBAC_BLOCKED")
                .executed(false)
                .build();
    }

    public static AiAssistantResponse createAccountantForbiddenResponse() {
        return AiAssistantResponse.builder()
                .reply(MSG_ACCOUNTANT_FORBIDDEN)
                .actionType("RBAC_BLOCKED")
                .executed(false)
                .build();
    }
}

