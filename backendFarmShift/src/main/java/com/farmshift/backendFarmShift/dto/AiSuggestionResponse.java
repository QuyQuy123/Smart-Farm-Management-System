package com.farmshift.backendFarmShift.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AiSuggestionResponse {
    private String role;
    private String roleLabel;
    private String routeLabel;
    private String inputPlaceholder;
    private String generatedAt;
    private List<SuggestionCard> suggestions;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class SuggestionCard {
        private String id;
        private String category;      // URGENT | ALERT | ACTION | INSIGHT
        private String badge;
        private String title;
        private String subtitle;
        private String prompt;
        private boolean autoSend;
        private String targetRoute;
        private int priorityScore;
    }
}
