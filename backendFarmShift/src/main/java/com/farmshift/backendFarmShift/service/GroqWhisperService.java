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

import java.io.IOException;
import java.time.Duration;

@Slf4j
@Service
public class GroqWhisperService {

    private static final String DOMAIN_PROMPT =
            "Hệ thống quản lý trang trại gà thịt FarmShift: Chuồng A1, Nhà A2, Nhà B1, cám Higro 01, Higro 02, " +
            "C.P. Việt Nam, Dabaco, Hanvet, vắc-xin Lasota, Gumboro, Newcastle, cân mẫu, hao hụt, nhập kho, NH000001.";

    private final String groqApiKey;
    private final String groqSttUrl;
    private final String groqSttModel;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;

    public GroqWhisperService(
            @Value("${app.ai.groq-api-key:}") String groqApiKey,
            @Value("${app.ai.groq-stt-url:https://api.groq.com/openai/v1/audio/transcriptions}") String groqSttUrl,
            @Value("${app.ai.groq-stt-model:whisper-large-v3}") String groqSttModel,
            ObjectMapper objectMapper
    ) {
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

        // If no API key configured, seamlessly fall back to browser Web Speech API
        if (groqApiKey.isBlank()) {
            log.info("No Groq API key configured. Utilizing Web Speech API fallback.");
            return SpeechTranscribeResponse.builder()
                    .text("")
                    .provider("WEB_SPEECH_FALLBACK")
                    .fallback(true)
                    .durationMs(System.currentTimeMillis() - startTime)
                    .build();
        }

        try {
            byte[] fileBytes = file.getBytes();
            String originalFilename = file.getOriginalFilename();
            if (originalFilename == null || originalFilename.isBlank()) {
                originalFilename = "audio_recording.webm";
            }
            final String finalFilename = originalFilename;

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
                String transcribedText = root.path("text").asText("").trim();
                long duration = System.currentTimeMillis() - startTime;
                log.info("Groq Whisper STT succeeded in {}ms: '{}'", duration, transcribedText);

                return SpeechTranscribeResponse.builder()
                        .text(transcribedText)
                        .provider("GROQ_WHISPER_LARGE_V3")
                        .fallback(false)
                        .durationMs(duration)
                        .build();
            } else {
                log.warn("Groq Whisper API returned non-200 status: {}", response.getStatusCode());
            }
        } catch (Exception ex) {
            log.warn("Error calling Groq Whisper API (falling back to Web Speech): {}", ex.getMessage());
        }

        return SpeechTranscribeResponse.builder()
                .text("")
                .provider("WEB_SPEECH_FALLBACK")
                .fallback(true)
                .durationMs(System.currentTimeMillis() - startTime)
                .build();
    }
}
