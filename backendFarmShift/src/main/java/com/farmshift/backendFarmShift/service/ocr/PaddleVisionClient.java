package com.farmshift.backendFarmShift.service.ocr;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Open-source PaddleOCR client (using RapidOCR PP-OCRv3 ONNX Java).
 * Runs 100% offline and locally inside the JVM without needing external AI API keys or Python.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PaddleVisionClient implements VisionClient {

    private final PaddleOcrEngine engine;
    private final PaddleInvoiceParser parser;

    @Override
    public boolean isConfigured() {
        return true; // Always available and ready offline!
    }

    @Override
    public JsonNode extractJson(String prompt, byte[] document, String mimeType, Map<String, Object> responseSchema) {
        log.info("Running local PaddleOCR on document of type {}", mimeType);
        PaddleOcrEngine.OcrDocumentResult ocrResult = engine.recognize(document, mimeType);
        JsonNode parsed = parser.parse(ocrResult);
        if (parsed instanceof com.fasterxml.jackson.databind.node.ObjectNode obj && !obj.has("engine")) {
            obj.put("engine", "RapidOCR");
        }
        return parsed;
    }
}
