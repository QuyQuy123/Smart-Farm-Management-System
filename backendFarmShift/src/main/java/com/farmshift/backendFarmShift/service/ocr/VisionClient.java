package com.farmshift.backendFarmShift.service.ocr;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.Map;

public interface VisionClient {
    boolean isConfigured();
    JsonNode extractJson(String prompt, byte[] document, String mimeType, Map<String, Object> responseSchema);
}
