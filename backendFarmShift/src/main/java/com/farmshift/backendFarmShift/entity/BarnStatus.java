package com.farmshift.backendFarmShift.entity;

/**
 * Trạng thái hoạt động của chuồng, do hệ thống tự quản: chuồng mới là chưa hoạt động, khai báo lứa nuôi
 * chuyển sang đang hoạt động, kết thúc lứa chuyển về chưa hoạt động.
 */
public enum BarnStatus {
    INACTIVE, ACTIVE
}
