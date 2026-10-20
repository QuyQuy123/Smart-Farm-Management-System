package com.farmshift.backendFarmShift.dto.response;

import com.farmshift.backendFarmShift.entity.AdministrationMethod;
import com.farmshift.backendFarmShift.entity.ProgramStepCategory;
import java.math.BigDecimal;
import java.util.List;

/**
 * Kế hoạch hôm nay của một đàn theo chương trình nuôi và ngày tuổi: cám (tổng kg/ngày, kg mỗi cữ), vắc-xin,
 * thuốc trộn, nhiệt độ cần giữ, công việc. Là cơ sở để công nhân đánh dấu hoàn thành công việc hằng ngày.
 */
public record FlockDayPlan(Long flockId, String flockCode, String flockName, Long programId, String programName, int ageDays,
                           int quantity, List<Item> items) {

    public record Item(ProgramStepCategory category, String name, BigDecimal quantity, String unit, Integer mealsPerDay,
                       AdministrationMethod method, BigDecimal tempMin, BigDecimal tempMax, BigDecimal totalFeedKg,
                       BigDecimal feedKgPerMeal, String note) {
    }
}
