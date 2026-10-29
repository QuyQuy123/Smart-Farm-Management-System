package com.farmshift.backendFarmShift.dto.response;

import com.farmshift.backendFarmShift.entity.AdministrationMethod;
import com.farmshift.backendFarmShift.entity.ProgramStepCategory;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Phiếu việc một ngày của một chuồng (lứa đang nuôi): định mức 1 con của chương trình × số con còn lại từng đàn, gộp theo chuồng.
 * Tiền (cost, unitPrice) là null với công nhân.
 */
public record BarnDayPlan(Long cycleId, String cycleCode, Long barnId, String barnName, String areaName, LocalDate date,
                          int headcount, List<FlockLine> flocks, List<Task> tasks, int doneCount, BigDecimal doneCost,
                          List<String> warnings, List<WorkBoard.WorkerRef> workers, List<WorkBoard.AssignedTask> assignedTasks) {

    /** Đàn có mặt trong chuồng ngày đó (số con cuối ngày, đã trừ hao hụt / xuất bán / chuyển đi). */
    public record FlockLine(Long flockId, String code, String name, String programName, int ageDays, int quantity) {
    }

    /**
     * Một việc. key ổn định để xác nhận / hoàn tác. plannedQuantity theo unit (kg, g, ml, liều); plannedStock là số đơn vị tồn kho
     * tương ứng (ví dụ 21,4 bao). stockEnough = false khi kho không đủ cho phần còn lại.
     */
    /** time: giờ cho ăn "HH:mm" của cữ (chỉ việc cho ăn), theo giờ cữ đầu đã cài và số cữ trong ngày. */
    public record Task(String key, ProgramStepCategory category, String name, Integer meal, Integer mealsPerDay, String time,
                       AdministrationMethod method, String doseText, BigDecimal plannedQuantity, String unit,
                       BigDecimal plannedStock, String stockUnit, Long inventoryItemId, String inventoryItemName,
                       BigDecimal stockOnHand, Boolean stockEnough, BigDecimal tempMin, BigDecimal tempMax, String note,
                       List<Share> shares, Done done) {
    }

    /** Phần của từng đàn trong lượng cả chuồng. */
    public record Share(Long flockId, String flockCode, int ageDays, int quantity, BigDecimal plannedQuantity) {
    }

    public record Done(Long id, BigDecimal actualQuantity, BigDecimal stockQuantity, BigDecimal unitPrice, BigDecimal cost,
                       boolean deviated, String note, String doneBy, LocalDateTime doneAt) {
    }
}
