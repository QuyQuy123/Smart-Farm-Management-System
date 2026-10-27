package com.farmshift.backendFarmShift.dto.request;

import jakarta.validation.constraints.NotNull;
import java.util.List;

/** Danh sách công nhân phụ trách chuồng (thay toàn bộ danh sách cũ). */
public record BarnWorkersRequest(@NotNull(message = "Vui lòng chọn công nhân.") List<@NotNull Long> workerIds) {
}
