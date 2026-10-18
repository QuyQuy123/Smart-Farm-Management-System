package com.farmshift.backendFarmShift.dto.response;

import com.farmshift.backendFarmShift.entity.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/** unitPrice is null for roles that may not see costs. */
public record FlockResponse(Long id, String code, String name, Long programId, String programName, FlockGender gender, FlockSource sourceType, String sourceNote,
                            String sourceFlockCode, LocalDate importDate, int ageAtImport, int currentAgeDays,
                            int importQuantity, BigDecimal importAvgWeight, BigDecimal importWeightKg, BigDecimal unitPrice,
                            int quantity, FlockStatus status, String note) {
}
