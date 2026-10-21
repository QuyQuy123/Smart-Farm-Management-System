package com.farmshift.backendFarmShift.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiAssistantRequest {
    @NotBlank(message = "Nội dung câu lệnh không được để trống.")
    private String message;
    private String currentRoute;
    @Builder.Default
    private Boolean autoExecute = true;
    @Builder.Default
    private java.util.List<java.util.Map<String, String>> history = new java.util.ArrayList<>();
}
