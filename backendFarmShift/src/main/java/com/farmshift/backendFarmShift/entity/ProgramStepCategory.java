package com.farmshift.backendFarmShift.entity;

/**
 * Nhóm nội dung của chương trình nuôi: cám định mức, vắc-xin, thuốc trộn, lịch uống thuốc, thủ thuật chăm sóc.
 * TEMPERATURE và WORK chỉ giữ lại để đọc dữ liệu lịch sử cũ (không hiển thị tab tạo mới trên UI).
 */
public enum ProgramStepCategory {
    FEED, VACCINE, MEDICINE, DRINKING_MEDICINE, CARE_PROCEDURE, TEMPERATURE, WORK
}
