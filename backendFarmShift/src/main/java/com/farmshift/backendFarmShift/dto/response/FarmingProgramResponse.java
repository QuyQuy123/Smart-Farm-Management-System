package com.farmshift.backendFarmShift.dto.response;

import java.math.BigDecimal;
import java.util.List;

/** activeFlockCount: số đàn đang nuôi theo chương trình này. currentDay: ngày tuổi dùng để tính state (null nếu là mẫu). */
public record FarmingProgramResponse(Long id, String code, String name, String breed, int durationDays, BigDecimal targetWeightMin,
                                     BigDecimal targetWeightMax, String description, List<ProgramStepResponse> steps,
                                     long activeFlockCount, Integer currentDay) {
}
