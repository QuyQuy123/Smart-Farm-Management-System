package com.farmshift.backendFarmShift.dto.response;

import com.farmshift.backendFarmShift.entity.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public record FlockMovementResponse(Long id, Long flockId, String flockCode, String flockName, FlockMovementType type,
                                    LocalDate movementDate, int quantity, BigDecimal weightKg, BigDecimal unitPrice, BigDecimal amount,
                                    String relatedFlockCode, String note, String createdBy) {
}
