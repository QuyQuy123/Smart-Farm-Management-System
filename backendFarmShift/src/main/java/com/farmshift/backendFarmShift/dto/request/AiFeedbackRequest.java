package com.farmshift.backendFarmShift.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record AiFeedbackRequest(
        @NotNull(message = "Thiếu mã lượt tương tác AI.")
        @Positive
        Long interactionId,

        @NotNull(message = "Thiếu đánh giá (+1 hoặc -1).")
        @Min(-1)
        @Max(1)
        Integer rating,

        @Size(max = 500, message = "Ghi chú đánh giá tối đa 500 ký tự.")
        String note,

        @Size(max = 80, message = "Nhãn ý định hiệu chỉnh tối đa 80 ký tự.")
        String correctedIntent
) {
}
