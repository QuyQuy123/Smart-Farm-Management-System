package com.farmshift.backendFarmShift.dto.request;

import jakarta.validation.constraints.NotNull;

import java.util.List;

public record BarnRoutineTasksRequest(
        @NotNull(message = "Vui lòng chọn danh sách công việc mặc định.") List<String> taskCodes
) {}
