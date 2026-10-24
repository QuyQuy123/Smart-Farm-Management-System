package com.farmshift.backendFarmShift.dto.request;

import jakarta.validation.constraints.NotNull;

/** Gắn (hoặc đổi) chương trình nuôi theo giống cho một đàn đang nuôi. */
public record FlockProgramRequest(
        @NotNull(message = "Vui lòng chọn chương trình nuôi.") Long programId) {
}
