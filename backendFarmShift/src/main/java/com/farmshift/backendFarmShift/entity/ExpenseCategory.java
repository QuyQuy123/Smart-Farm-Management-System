package com.farmshift.backendFarmShift.entity;

/** Khoản chi bổ sung của lứa nuôi. */
public enum ExpenseCategory {
    ELECTRICITY, WATER, LABOR, MEDICINE, OTHER;

    /** Điện, nước, nhân công chưa được phân bổ vào giá thành lứa; dữ liệu đã ghi vẫn giữ nguyên. */
    public boolean countsInCycleCost() {
        return this == MEDICINE || this == OTHER;
    }
}
