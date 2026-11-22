package com.farmshift.backendFarmShift.service.ocr;

import com.farmshift.backendFarmShift.exception.BadRequestException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import java.util.UUID;

/**
 * Client duy nhất kết nối Backend Spring Boot với microservice aiServiceFarmShift (Python FastAPI, cổng 8000).
 * Toàn bộ gánh nặng xử lý AI (Computer Vision, OpenCV, OCR Models, Vision LLMs) được chuyển hẳn sang aiServiceFarmShift.
 */
@Slf4j
@Primary
@Component
public class AiServiceVisionClient implements VisionClient {

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final String aiServiceUrl;

    @Value("${ai-service.internal-token:${AI_INTERNAL_TOKEN:farmshift-local-ai-token}}")
    private String internalAiToken = "farmshift-local-ai-token";

    public AiServiceVisionClient(
            ObjectMapper objectMapper,
            @Value("${ai-service.url:http://localhost:8000}") String aiServiceUrl
    ) {
        this.objectMapper = objectMapper;
        this.aiServiceUrl = aiServiceUrl != null ? aiServiceUrl.strip().replaceAll("/+$", "") : "http://localhost:8000";
        this.httpClient = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    @Override
    public boolean isConfigured() {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(aiServiceUrl + "/health"))
                    .timeout(Duration.ofSeconds(2))
                    .GET()
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            return response.statusCode() == 200;
        } catch (Exception e) {
            log.debug("aiServiceFarmShift is not reachable at {}: {}", aiServiceUrl, e.getMessage());
            return false;
        }
    }

    @Override
    public JsonNode extractJson(String prompt, byte[] document, String mimeType, Map<String, Object> responseSchema) {
        String boundary = "----FarmShiftBoundary" + UUID.randomUUID();
        String extension = "application/pdf".equalsIgnoreCase(mimeType) ? "pdf" : "png";
        String filename = "invoice." + extension;

        try {
            byte[] multipartBody = createMultipartPayload(boundary, "file", filename, mimeType, document);

            String requestId = resolveRequestId();
            HttpRequest.Builder reqBuilder = HttpRequest.newBuilder()
                    .uri(URI.create(aiServiceUrl + "/api/ocr/extract-invoice"))
                    .timeout(Duration.ofSeconds(65))
                    .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                    .header("X-Request-ID", requestId);
            if (internalAiToken != null && !internalAiToken.isBlank()) {
                reqBuilder.header("X-Internal-AI-Token", internalAiToken);
            }
            HttpRequest request = reqBuilder
                    .POST(HttpRequest.BodyPublishers.ofByteArray(multipartBody))
                    .build();

            log.info("Sending invoice extraction request [requestId={}] to aiServiceFarmShift at {}/api/ocr/extract-invoice", requestId, aiServiceUrl);
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));

            if (response.statusCode() == 200) {
                JsonNode parsed = objectMapper.readTree(response.body());
                log.info("Successfully extracted invoice [requestId={}] from aiServiceFarmShift, confidence={}", requestId, parsed.path("confidence").asDouble(0));
                return parsed;
            }

            String message = "Dịch vụ AI (aiServiceFarmShift) phản hồi lỗi: " + response.statusCode();
            try {
                JsonNode detail = objectMapper.readTree(response.body()).path("detail");
                if (detail.isTextual() && !detail.asText().isBlank() && detail.asText().length() <= 500) {
                    message = detail.asText();
                }
            } catch (Exception ignored) {
                // Non-JSON error body from upstream/proxy
            }
            log.warn("aiServiceFarmShift returned status {} [requestId={}] for invoice OCR", response.statusCode(), requestId);
            throw new BadRequestException(message, "AI_SERVICE_ERROR");
        } catch (BadRequestException e) {
            throw e;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BadRequestException("Đã ngắt xử lý bóc tách hóa đơn.", "AI_SERVICE_ERROR");
        } catch (Exception ex) {
            log.warn("Failed to communicate with aiServiceFarmShift ({}): {}", aiServiceUrl, ex.getMessage());
            throw new BadRequestException(
                    "Không kết nối được dịch vụ AI OCR. Vui lòng thử lại sau.",
                    "AI_SERVICE_ERROR"
            );
        }
    }

    private static String resolveRequestId() {
        String cid = MDC.get("requestId");
        return (cid != null && !cid.isBlank()) ? cid.trim() : UUID.randomUUID().toString();
    }

    private byte[] createMultipartPayload(String boundary, String fieldName, String filename, String mimeType, byte[] fileBytes) throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        baos.write(("--" + boundary + "\r\n").getBytes(StandardCharsets.UTF_8));
        baos.write(("Content-Disposition: form-data; name=\"" + fieldName + "\"; filename=\"" + filename + "\"\r\n").getBytes(StandardCharsets.UTF_8));
        baos.write(("Content-Type: " + mimeType + "\r\n\r\n").getBytes(StandardCharsets.UTF_8));
        baos.write(fileBytes);
        baos.write(("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
        return baos.toByteArray();
    }
}
