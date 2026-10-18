package com.farmshift.backendFarmShift.dto.response;

import com.farmshift.backendFarmShift.entity.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/** One journal line of a cycle: a feed record, a weight sample or an expense, depending on {@code kind}. */
public record CycleRecordResponse(Long id, String kind, LocalDate date, String label, BigDecimal quantity, BigDecimal unitPrice,
                                  BigDecimal amount, Integer sampleSize, String category, String note, String createdBy) {
}
