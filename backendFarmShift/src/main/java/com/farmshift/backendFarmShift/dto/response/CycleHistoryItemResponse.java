package com.farmshift.backendFarmShift.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Bản ghi tổng hợp một lứa nuôi đã kết thúc (CLOSED) toàn trại (OPS-03).
 * Toàn bộ trường tài chính (totalCost, revenue, profit, costPerKg, totalDiseaseMedicineCost) trả null khi !canSeeFinance.
 */
public record CycleHistoryItemResponse(
        Long cycleId,
        String cycleCode,
        int cycleNumber,
        Long barnId,
        String barnName,
        Long areaId,
        String areaName,
        LocalDate startDate,
        LocalDate endDate,
        int durationDays,
        List<Long> programIds,
        List<String> programNames,
        List<String> breeds,
        int totalIn,
        int harvestedQuantity,
        int deaths,
        int culls,
        BigDecimal survivalRate,
        BigDecimal feedKg,
        BigDecimal fcr,
        BigDecimal harvestedWeightKg,
        BigDecimal avgHarvestWeightKg,
        int diseaseCount,
        BigDecimal totalDiseaseMedicineCost,
        BigDecimal totalCost,
        BigDecimal revenue,
        BigDecimal profit,
        BigDecimal costPerKg
) { }
