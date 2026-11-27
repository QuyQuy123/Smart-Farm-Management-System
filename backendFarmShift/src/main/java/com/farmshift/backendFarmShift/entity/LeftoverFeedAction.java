package com.farmshift.backendFarmShift.entity;

/**
 * Phương án xử lý cám đang mở bao còn dư tại chuồng khi kết thúc lứa nuôi.
 */
public enum LeftoverFeedAction {
    TRANSFER_TO_CYCLE,
    RETURN_TO_WAREHOUSE,
    WRITE_OFF
}
