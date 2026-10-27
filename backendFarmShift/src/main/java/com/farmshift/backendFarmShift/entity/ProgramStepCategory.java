package com.farmshift.backendFarmShift.entity;

/**
 * Nhóm nội dung của chương trình nuôi: cám định mức, vắc-xin, thuốc trộn, nhiệt độ chuồng.
 * WORK (công việc) chỉ còn để đọc dữ liệu cũ: chương trình nuôi không nhận công việc nữa, việc chăm sóc được giao riêng.
 */
public enum ProgramStepCategory {
    FEED, VACCINE, MEDICINE, TEMPERATURE, WORK
}
