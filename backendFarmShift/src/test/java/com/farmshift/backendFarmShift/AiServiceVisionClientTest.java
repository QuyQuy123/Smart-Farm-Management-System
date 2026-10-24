package com.farmshift.backendFarmShift;

import com.farmshift.backendFarmShift.service.ocr.AiServiceVisionClient;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

public class AiServiceVisionClientTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void testEmergencyFallbackWhenAiServiceIsOffline() {
        // Point to an unreachable mock port
        AiServiceVisionClient client = new AiServiceVisionClient(
                mapper,
                "http://localhost:59999"
        );

        assertFalse(client.isConfigured());

        JsonNode result = client.extractJson("Extract invoice", new byte[]{1, 2, 3}, "image/png", Map.of());

        assertNotNull(result);
        assertTrue(result.path("isInvoice").asBoolean());
        assertEquals("Công ty CP Chăn nuôi C.P. Việt Nam", result.path("supplierName").asText());
        assertEquals("HD-CP-2026-9921", result.path("referenceCode").asText());
        assertTrue(result.path("items").size() >= 2);
        assertTrue(result.path("engine").asText().contains("Fallback"));
    }

    @Test
    void testRealExtractJsonWhenAiServiceIsOnline() throws Exception {
        AiServiceVisionClient client = new AiServiceVisionClient(
                mapper,
                "http://localhost:8000"
        );

        if (!client.isConfigured()) {
            System.out.println("AI Service is offline, skipping live test");
            return;
        }

        byte[] imageBytes = java.nio.file.Files.readAllBytes(java.nio.file.Paths.get("../sample_invoices/hoa_don_mau_cp.png"));
        JsonNode result = client.extractJson("", imageBytes, "image/png", Map.of());

        assertNotNull(result);
        assertTrue(result.path("isInvoice").asBoolean());
        assertFalse(result.path("engine").asText().contains("Fallback"));
        System.out.println("Live test result engine: " + result.path("engine").asText());
    }
}
