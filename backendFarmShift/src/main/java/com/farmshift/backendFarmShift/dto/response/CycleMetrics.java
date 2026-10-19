package com.farmshift.backendFarmShift.dto.response;

import com.farmshift.backendFarmShift.entity.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/** Chỉ số kỹ thuật của lứa nuôi. Các giá trị không tính được (chưa có dữ liệu) là null. */
public record CycleMetrics(int dayOfCycle, Integer ageDays, int totalIn, int currentQuantity, int deaths, int culls,
                           int harvestedQuantity, int transferredOut, BigDecimal lossRate, BigDecimal cullRate, BigDecimal harvestRate,
                           BigDecimal avgWeightKg, BigDecimal biomassKg, BigDecimal densityPerM2, BigDecimal feedKg,
                           BigDecimal weightGainKg, BigDecimal fcr, BigDecimal harvestedWeightKg,
                           LocalDate firstImportDate, LocalDate importDeadline, int capacity) {
}
