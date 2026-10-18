package com.farmshift.backendFarmShift.dto.response;

import com.farmshift.backendFarmShift.entity.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/** Hạch toán lứa nuôi, chỉ trả cho chủ trại và kế toán. */
public record CycleFinance(BigDecimal chickCost, BigDecimal feedCost, Map<String, BigDecimal> expenses, BigDecimal totalCost,
                           BigDecimal costPerKg, BigDecimal costPerHead, BigDecimal revenue, BigDecimal profit) {
}
