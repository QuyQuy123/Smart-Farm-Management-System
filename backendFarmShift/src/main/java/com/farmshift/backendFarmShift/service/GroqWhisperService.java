package com.farmshift.backendFarmShift.service;

import com.farmshift.backendFarmShift.dto.SpeechTranscribeResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.time.Duration;

/**
 * Service providing Speech-To-Text (STT) capabilities.
 * Delegates audio transcription to the dedicated {@code aiServiceFarmShift} microservice,
 * with secondary fallback to direct Groq Whisper or browser Web Speech API.
 */
@Slf4j
@Service
public class GroqWhisperService {

    private static final String DOMAIN_PROMPT =
            "FarmShift, trang trại gà thịt thương phẩm. Khu Mía Thịt, Khu J Thịt, Khu đông tảo, " +
            "Nhà A1, Nhà A2, Nhà B1, Nhà B2, chuồng nuôi, lứa nuôi. " +
            "Ghi nhật ký cho ăn, Cám Higro 01, Cám Higro 02, Cám CP 511, bao cám, cân mẫu, trọng lượng trung bình, " +
            "hao hụt, gà chết, thải loại, xuất bán, thu hoạch. Việc hôm nay, Phân công công việc, " +
            "Xuất nhập nội bộ, Quản lý đơn nhập hàng, Hóa đơn bán hàng, Kho hàng, Sổ quỹ, Công nợ, Nhà cung cấp, " +
            "Báo cáo lãi lỗ, Hiệu suất chăn nuôi, FCR. Dabaco, CP Việt Nam, Cargill, Hanvet, Lasota, Gumboro, " +
            "Newcastle, Men tiêu hóa, Điện giải Gluco-K-C, NH000001, NH000002, XNB000001.";

    private final String aiServiceUrl;
    private final String groqApiKey;
    private final String groqSttUrl;
    private final String groqSttModel;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;

    public GroqWhisperService(
            @Value("${ai-service.url:http://localhost:8000}") String aiServiceUrl,
            @Value("${app.ai.groq-api-key:}") String groqApiKey,
            @Value("${app.ai.groq-stt-url:https://api.groq.com/openai/v1/audio/transcriptions}") String groqSttUrl,
            @Value("${app.ai.groq-stt-model:whisper-large-v3}") String groqSttModel,
            ObjectMapper objectMapper
    ) {
        this.aiServiceUrl = aiServiceUrl != null ? aiServiceUrl.strip().replaceAll("/+$", "") : "http://localhost:8000";
        this.groqApiKey = groqApiKey != null ? groqApiKey.strip() : "";
        this.groqSttUrl = groqSttUrl != null && !groqSttUrl.isBlank() ? groqSttUrl.strip() : "https://api.groq.com/openai/v1/audio/transcriptions";
        this.groqSttModel = groqSttModel != null && !groqSttModel.isBlank() ? groqSttModel.strip() : "whisper-large-v3";
        this.objectMapper = objectMapper;

        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(10));
        requestFactory.setReadTimeout(Duration.ofSeconds(30));
        this.restTemplate = new RestTemplate(requestFactory);
    }

    public SpeechTranscribeResponse transcribe(MultipartFile file) {
        long startTime = System.currentTimeMillis();

        if (file == null || file.isEmpty()) {
            return SpeechTranscribeResponse.builder()
                    .text("")
                    .provider("WEB_SPEECH_FALLBACK")
                    .fallback(true)
                    .durationMs(0L)
                    .build();
        }

        byte[] fileBytes;
        String originalFilename;
        try {
            fileBytes = file.getBytes();
            originalFilename = file.getOriginalFilename() != null && !file.getOriginalFilename().isBlank()
                    ? file.getOriginalFilename() : "audio_recording.webm";
        } catch (Exception ex) {
            log.error("Failed to read audio file bytes: {}", ex.getMessage());
            return SpeechTranscribeResponse.builder()
                    .text("")
                    .provider("WEB_SPEECH_FALLBACK")
                    .fallback(true)
                    .durationMs(System.currentTimeMillis() - startTime)
                    .build();
        }

        final String finalFilename = originalFilename;

        // 1. Delegate to dedicated aiServiceFarmShift microservice
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            ByteArrayResource fileResource = new ByteArrayResource(fileBytes) {
                @Override
                public String getFilename() {
                    return finalFilename;
                }
            };
            body.add("file", fileResource);

            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);
            String targetUrl = aiServiceUrl + "/api/voice/transcribe";

            ResponseEntity<String> response = restTemplate.postForEntity(targetUrl, requestEntity, String.class);
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                String transcribedText = root.path("text").asText("").trim();
                boolean fallback = root.path("fallback").asBoolean(false);
                String provider = root.path("provider").asText("AI_SERVICE_WHISPER");
                long duration = root.has("durationMs") ? root.path("durationMs").asLong()
                        : (root.has("duration_ms") ? root.path("duration_ms").asLong() : (System.currentTimeMillis() - startTime));

                log.info("aiServiceFarmShift STT succeeded in {}ms: '{}'", duration, transcribedText);
                return SpeechTranscribeResponse.builder()
                        .text(transcribedText)
                        .provider(provider)
                        .fallback(fallback)
                        .durationMs(duration)
                        .build();
            }
        } catch (Exception ex) {
            log.warn("aiServiceFarmShift unavailable for voice STT ({}/api/voice/transcribe): {}", aiServiceUrl, ex.getMessage());
        }

        // 2. Secondary fallback: Direct Groq Whisper API (if groqApiKey is configured directly in backend)
        if (!groqApiKey.isBlank()) {
            try {
                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.MULTIPART_FORM_DATA);
                headers.setBearerAuth(groqApiKey);

                MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
                ByteArrayResource fileResource = new ByteArrayResource(fileBytes) {
                    @Override
                    public String getFilename() {
                        return finalFilename;
                    }
                };

                body.add("file", fileResource);
                body.add("model", groqSttModel);
                body.add("language", "vi");
                body.add("temperature", "0");
                body.add("response_format", "verbose_json");
                body.add("prompt", DOMAIN_PROMPT);

                HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);
                ResponseEntity<String> response = restTemplate.postForEntity(groqSttUrl, requestEntity, String.class);

                if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                    JsonNode root = objectMapper.readTree(response.getBody());
                    String rawText = root.path("text").asText("").trim();
                    String transcribedText = VietnameseSpeechNormalizer.normalizeVietnameseCommand(rawText);
                    long duration = System.currentTimeMillis() - startTime;
                    log.info("Direct Groq Whisper STT succeeded in {}ms: '{}'", duration, transcribedText);

                    return SpeechTranscribeResponse.builder()
                            .text(transcribedText)
                            .provider("GROQ_WHISPER_LARGE_V3")
                            .fallback(false)
                            .durationMs(duration)
                            .build();
                }
            } catch (Exception ex) {
                log.warn("Error calling direct Groq Whisper API: {}", ex.getMessage());
            }
        }

        // 3. Final fallback: Browser Web Speech API
        return SpeechTranscribeResponse.builder()
                .text("")
                .provider("WEB_SPEECH_FALLBACK")
                .fallback(true)
                .durationMs(System.currentTimeMillis() - startTime)
                .build();
    }
}
