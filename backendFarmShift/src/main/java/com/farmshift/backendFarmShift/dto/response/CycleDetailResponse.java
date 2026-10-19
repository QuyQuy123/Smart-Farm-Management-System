package com.farmshift.backendFarmShift.dto.response;

import com.farmshift.backendFarmShift.entity.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/** Toàn bộ dữ liệu trang chi tiết lứa nuôi. finance và expenses là null với công nhân. */
public record CycleDetailResponse(CycleSummaryResponse cycle, BarnResponse barn, CycleMetrics metrics, CycleFinance finance,
                                  List<FlockResponse> flocks, List<FarmingProgramResponse> programs,
                                  List<FlockMovementResponse> movements, List<CycleRecordResponse> feedRecords,
                                  List<CycleRecordResponse> weightSamples, List<CycleRecordResponse> expenses,
                                  List<FlockDayPlan> todayPlan) {
}
