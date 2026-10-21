package com.farmshift.backendFarmShift.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SpeechTranscribeResponse {
    private String text;
    private String provider;
    private boolean fallback;
    private Long durationMs;
}
