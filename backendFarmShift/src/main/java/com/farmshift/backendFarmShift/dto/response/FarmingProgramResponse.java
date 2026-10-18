package com.farmshift.backendFarmShift.dto.response;

import com.farmshift.backendFarmShift.entity.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public record FarmingProgramResponse(Long id, String code, String name, ProgramType type, String description,
                                     List<ProgramStepResponse> steps, long activeCycleCount) {
}
