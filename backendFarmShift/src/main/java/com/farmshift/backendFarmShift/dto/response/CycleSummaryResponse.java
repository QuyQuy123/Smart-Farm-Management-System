package com.farmshift.backendFarmShift.dto.response;

import com.farmshift.backendFarmShift.entity.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public record CycleSummaryResponse(Long id, String code, Long barnId, int cycleNumber, LocalDate startDate, LocalDate hatchDate,
                                   LocalDate endDate, CycleStatus status, String note, int totalIn, int currentQuantity) {
}
