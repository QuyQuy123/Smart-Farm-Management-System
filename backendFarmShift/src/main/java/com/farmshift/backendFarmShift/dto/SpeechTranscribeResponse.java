package com.farmshift.backendFarmShift.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SpeechTranscribeResponse {
    private String text;
    private String rawText;
    private String normalizedText;
    private Double confidence;
    private Double durationSec;
    private Boolean autoSubmitEligible;
    private String rejectedReason;
    private List<Map<String, String>> corrections;
    private Integer segmentsFiltered;
    private String provider;
    private boolean fallback;
    private Long durationMs;
}
