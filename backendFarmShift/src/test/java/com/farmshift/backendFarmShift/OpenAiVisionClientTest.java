package com.farmshift.backendFarmShift;

import com.farmshift.backendFarmShift.service.ocr.OpenAiVisionClient;
import com.farmshift.backendFarmShift.service.ocr.PaddleVisionClient;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.*;

public class OpenAiVisionClientTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void testFallbackWhenKeyNotConfigured() {
        AtomicBoolean called = new AtomicBoolean(false);
        PaddleVisionClient fallback = new PaddleVisionClient(null, null) {
            @Override
            public JsonNode extractJson(String prompt, byte[] document, String mimeType, Map<String, Object> responseSchema) {
                called.set(true);
                return mapper.createObjectNode().put("isInvoice", true);
            }
        };

        OpenAiVisionClient client = new OpenAiVisionClient(
                fallback,
                mapper,
                "", // empty api key
                "gpt-5.6-sol",
                "https://api.openai.com/v1/chat/completions",
                60,
                "openai"
        );

        assertFalse(client.isConfigured());
        JsonNode result = client.extractJson("", new byte[]{1, 2, 3}, "image/png", Map.of());
        assertNotNull(result);
        assertTrue(result.path("isInvoice").asBoolean());
        assertEquals("RapidOCR", result.path("engine").asText());
        assertTrue(called.get());
    }

    @Test
    void testExplicitRapidOcrProviderBypassesOpenAi() {
        AtomicBoolean called = new AtomicBoolean(false);
        PaddleVisionClient fallback = new PaddleVisionClient(null, null) {
            @Override
            public JsonNode extractJson(String prompt, byte[] document, String mimeType, Map<String, Object> responseSchema) {
                called.set(true);
                return mapper.createObjectNode().put("isInvoice", true);
            }
        };

        OpenAiVisionClient client = new OpenAiVisionClient(
                fallback,
                mapper,
                "sk-proj-somekey",
                "gpt-5.6-sol",
                "https://api.openai.com/v1/chat/completions",
                60,
                "rapidocr"
        );

        assertTrue(client.isConfigured());
        JsonNode result = client.extractJson("", new byte[]{1, 2, 3}, "image/png", Map.of());
        assertNotNull(result);
        assertEquals("RapidOCR", result.path("engine").asText());
        assertTrue(called.get());
    }

    @Test
    void testOpenAiNetworkFailureFallsBackToRapidOcr() {
        AtomicBoolean called = new AtomicBoolean(false);
        PaddleVisionClient fallback = new PaddleVisionClient(null, null) {
            @Override
            public JsonNode extractJson(String prompt, byte[] document, String mimeType, Map<String, Object> responseSchema) {
                called.set(true);
                return mapper.createObjectNode().put("isInvoice", true);
            }
        };

        OpenAiVisionClient client = new OpenAiVisionClient(
                fallback,
                mapper,
                "sk-proj-invalidkey",
                "gpt-5.6-sol",
                "https://invalid-non-existent-domain-xyz123.com/v1/chat/completions",
                1,
                "openai"
        );

        assertTrue(client.isConfigured());
        JsonNode result = client.extractJson("", new byte[]{1, 2, 3}, "image/png", Map.of());
        assertNotNull(result);
        assertTrue(result.path("engine").asText().contains("RapidOCR"));
        assertTrue(result.path("warnings").get(0).asText().contains("OpenAI Vision"));
        assertTrue(called.get());
    }
}
