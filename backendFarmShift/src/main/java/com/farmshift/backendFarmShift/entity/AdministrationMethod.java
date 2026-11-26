package com.farmshift.backendFarmShift.entity;

/**
 * Cách dùng vắc-xin / thuốc / thủ thuật.
 * Vắc-xin: nhỏ mắt mũi, nhỏ miệng, pha nước uống, tiêm, chủng màng cánh.
 * Thuốc trộn: trộn cám, pha nước uống.
 * Lịch uống thuốc: bình xách tay, hệ thống uống tự động.
 * Thủ thuật chăm sóc: thực hiện thủ thuật (ví dụ làm mỏ).
 */
public enum AdministrationMethod {
    EYE_NOSE, MOUTH, DRINKING_WATER, INJECTION, WING_WEB, MIX_FEED, MIX_WATER,
    HAND_DRINKER, AUTO_DRINKER, PROCEDURE
}
