package com.farmshift.backendFarmShift.dto.response;

import com.farmshift.backendFarmShift.entity.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/** state: DONE / IN_PROGRESS / UPCOMING so với ngày tuổi hiện tại của lứa (null với chương trình mẫu). */
public record ProgramStepResponse(Long id, String name, int dayFrom, int dayTo, BigDecimal quantity, String unit, String note, String state) {
}
