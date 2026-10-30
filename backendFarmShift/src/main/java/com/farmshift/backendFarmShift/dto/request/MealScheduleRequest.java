package com.farmshift.backendFarmShift.dto.request;

import jakarta.validation.constraints.NotNull;
import java.time.LocalTime;

/** Giờ cho ăn cữ đầu tiên trong ngày; các cữ sau tự chia đều. */
public record MealScheduleRequest(@NotNull(message = "Vui lòng chọn giờ cữ ăn đầu tiên.") LocalTime firstMealTime) {
}
