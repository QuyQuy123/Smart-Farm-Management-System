package com.farmshift.backendFarmShift.service;

import com.farmshift.backendFarmShift.dto.SpeechTranscribeResponse;
import com.farmshift.backendFarmShift.security.RoleNames;
import com.farmshift.backendFarmShift.service.ai.AiSecurityGuard;
import com.farmshift.backendFarmShift.service.ai.DynamicVietnameseSpeechNormalizer;
import com.farmshift.backendFarmShift.service.ai.VoiceContextPromptBuilder;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Service providing Speech-To-Text (STT) capabilities.
 * Builds RBAC-scoped dynamic context prompts, forwards audio streams cleanly in-memory
 * to {@code aiServiceFarmShift}, applies Vietnamese spoken-number/fuzzy normalization,
 * and screens transcripts through {@code AiSecurityGuard}.
 */
@Slf4j
@Service
public class GroqWhisperService {

    public static final double AUTO_SUBMIT_CONFIDENCE_THRESHOLD = 0.82;

    private final String aiServiceUrl;
    private final String internalAiToken;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;

    @Autowired(required = false)
    private DynamicVietnameseSpeechNormalizer dynamicNormalizer;

    @Autowired(required = false)
    private VoiceContextPromptBuilder voiceContextPromptBuilder;

    @Autowired(required = false)
    private AiSecurityGuard aiSecurityGuard;

    @Autowired
    public GroqWhisperService(
            @Value("${ai-service.url:http://localhost:8000}") String aiServiceUrl,
            @Value("${ai-service.internal-token:${AI_INTERNAL_TOKEN:farmshift-local-ai-token}}") String internalAiToken,
            ObjectMapper objectMapper
    ) {
        this.aiServiceUrl = aiServiceUrl != null ? aiServiceUrl.strip().replaceAll("/+$", "") : "http://localhost:8000";
        this.internalAiToken = internalAiToken != null ? internalAiToken.strip() : "";
        this.objectMapper = objectMapper;

        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(5));
        requestFactory.setReadTimeout(Duration.ofSeconds(25));
        this.restTemplate = new RestTemplate(requestFactory);
    }

    public GroqWhisperService(String aiServiceUrl, ObjectMapper objectMapper) {
        this(aiServiceUrl, "farmshift-local-ai-token", objectMapper);
    }

    public SpeechTranscribeResponse transcribe(MultipartFile file) {
        return transcribe(file, null, null);
    }

    public SpeechTranscribeResponse transcribe(
            MultipartFile file,
            String username,
            Collection<? extends GrantedAuthority> authorities
    ) {
        long startTime = System.currentTimeMillis();

        if (file == null || file.isEmpty()) {
            return SpeechTranscribeResponse.builder()
                    .text("")
                    .rawText("")
                    .normalizedText("")
                    .confidence(0.0)
                    .durationSec(0.0)
                    .autoSubmitEligible(false)
                    .rejectedReason("EMPTY_AUDIO")
                    .corrections(List.of())
                    .segmentsFiltered(0)
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
                    ? file.getOriginalFilename() : "voice.webm";
        } catch (Exception ex) {
            log.error("Failed to read audio file bytes: {}", ex.getMessage());
            return fallbackResponse(System.currentTimeMillis() - startTime);
        }

        final String finalFilename = originalFilename;
        final boolean isWorker = isWorkerRole(authorities);

        // 1. Build RBAC-scoped dynamic Whisper context prompt & entities_json (60s cached)
        VoiceContextPromptBuilder.VoiceContextPayload voiceContext = null;
        if (voiceContextPromptBuilder != null) {
            try {
                voiceContext = voiceContextPromptBuilder.buildForUser(username, isWorker);
            } catch (Exception ex) {
                log.warn("Could not build VoiceContextPromptBuilder payload: {}", ex.getMessage());
            }
        }

        // 2. Delegate in-memory to aiServiceFarmShift
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);
            if (!internalAiToken.isBlank()) {
                headers.set("X-Internal-AI-Token", internalAiToken);
            }

            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            ByteArrayResource fileResource = new ByteArrayResource(fileBytes) {
                @Override
                public String getFilename() {
                    return finalFilename;
                }
            };
            body.add("file", fileResource);
            if (voiceContext != null) {
                if (voiceContext.contextPrompt() != null && !voiceContext.contextPrompt().isBlank()) {
                    body.add("context_prompt", voiceContext.contextPrompt());
                }
                if (voiceContext.entitiesJson() != null && !voiceContext.entitiesJson().isBlank()) {
                    body.add("entities_json", voiceContext.entitiesJson());
                }
            }

            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);
            String targetUrl = aiServiceUrl + "/api/voice/transcribe";

            ResponseEntity<String> response = restTemplate.postForEntity(targetUrl, requestEntity, String.class);
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                boolean fallback = root.path("fallback").asBoolean(false);
                String provider = root.path("provider").asText("GROQ_WHISPER_LARGE_V3");
                long duration = root.has("durationMs") ? root.path("durationMs").asLong()
                        : (root.has("duration_ms") ? root.path("duration_ms").asLong() : (System.currentTimeMillis() - startTime));
                double durationSec = root.has("duration_sec") ? root.path("duration_sec").asDouble(0.0)
                        : root.path("durationSec").asDouble(0.0);
                int segmentsFiltered = root.has("segments_filtered") ? root.path("segments_filtered").asInt(0)
                        : root.path("segmentsFiltered").asInt(0);
                String rejectedReason = extractNullableText(root, "rejected_reason", "rejectedReason");
                String rawText = root.hasNonNull("raw_text") ? root.path("raw_text").asText("").trim()
                        : root.path("text").asText("").trim();

                List<Map<String, String>> corrections = parseCorrections(root.path("corrections"));

                if (rejectedReason != null && !rejectedReason.isBlank()) {
                    return SpeechTranscribeResponse.builder()
                            .text("")
                            .rawText(rawText)
                            .normalizedText("")
                            .confidence(0.0)
                            .durationSec(durationSec)
                            .autoSubmitEligible(false)
                            .rejectedReason(rejectedReason)
                            .corrections(corrections)
                            .segmentsFiltered(segmentsFiltered)
                            .provider(provider)
                            .fallback(false)
                            .durationMs(duration)
                            .build();
                }

                String aiText = root.hasNonNull("normalized_text") && !root.path("normalized_text").asText("").isBlank()
                        ? root.path("normalized_text").asText("").trim()
                        : root.path("text").asText("").trim();

                String finalText;
                if (isWorker) {
                    if (dynamicNormalizer != null && voiceContext != null) {
                        var normResult = dynamicNormalizer.normalizeWithCorrectionsScoped(aiText, voiceContext.entities());
                        finalText = normResult.normalizedText();
                        mergeCorrections(corrections, normResult.corrections());
                    } else {
                        finalText = VietnameseSpeechNormalizer.normalizeSpokenTranscript(aiText);
                    }
                } else if (dynamicNormalizer != null) {
                    var normResult = dynamicNormalizer.normalizeWithCorrections(aiText);
                    finalText = normResult.normalizedText();
                    mergeCorrections(corrections, normResult.corrections());
                } else {
                    finalText = VietnameseSpeechNormalizer.normalizeSpokenTranscript(aiText);
                }

                if (aiSecurityGuard != null && !finalText.isBlank()) {
                    var guardDecision = aiSecurityGuard.inspectInput(finalText, username, isWorker);
                    if (guardDecision != null) {
                        return SpeechTranscribeResponse.builder()
                                .text("")
                                .rawText(rawText)
                                .normalizedText("")
                                .confidence(0.0)
                                .durationSec(durationSec)
                                .autoSubmitEligible(false)
                                .rejectedReason("SECURITY_BLOCKED")
                                .corrections(List.of())
                                .segmentsFiltered(segmentsFiltered)
                                .provider(provider)
                                .fallback(false)
                                .durationMs(duration)
                                .build();
                    }
                }

                double confidence = root.has("confidence") && root.path("confidence").isNumber()
                        ? root.path("confidence").asDouble()
                        : (fallback ? 0.0 : 0.85);
                boolean autoSubmitEligible = !fallback
                        && !finalText.isBlank()
                        && confidence >= AUTO_SUBMIT_CONFIDENCE_THRESHOLD;

                log.info("aiServiceFarmShift STT succeeded in {}ms (conf={}): '{}'", duration, confidence, finalText);
                return SpeechTranscribeResponse.builder()
                        .text(finalText)
                        .rawText(rawText)
                        .normalizedText(finalText)
                        .confidence(confidence)
                        .durationSec(durationSec)
                        .autoSubmitEligible(autoSubmitEligible)
                        .rejectedReason(null)
                        .corrections(corrections)
                        .segmentsFiltered(segmentsFiltered)
                        .provider(provider)
                        .fallback(fallback)
                        .durationMs(duration)
                        .build();
            }
        } catch (Exception ex) {
            log.warn("aiServiceFarmShift unavailable for voice STT ({}/api/voice/transcribe): {}", aiServiceUrl, ex.getMessage());
        }

        return fallbackResponse(System.currentTimeMillis() - startTime);
    }

    private static boolean isWorkerRole(Collection<? extends GrantedAuthority> authorities) {
        if (authorities == null || authorities.isEmpty()) {
            return false;
        }
        boolean hasWorker = false;
        boolean hasElevated = false;
        for (GrantedAuthority auth : authorities) {
            if (auth == null || auth.getAuthority() == null) continue;
            String role = auth.getAuthority();
            if (RoleNames.FARM_WORKER.equals(role)) {
                hasWorker = true;
            } else if (RoleNames.FARM_OWNER.equals(role) || RoleNames.ACCOUNTANT.equals(role)) {
                hasElevated = true;
            }
        }
        return hasWorker && !hasElevated;
    }

    private static SpeechTranscribeResponse fallbackResponse(long durationMs) {
        return SpeechTranscribeResponse.builder()
                .text("")
                .rawText("")
                .normalizedText("")
                .confidence(0.0)
                .durationSec(0.0)
                .autoSubmitEligible(false)
                .rejectedReason(null)
                .corrections(List.of())
                .segmentsFiltered(0)
                .provider("WEB_SPEECH_FALLBACK")
                .fallback(true)
                .durationMs(durationMs)
                .build();
    }

    private static String extractNullableText(JsonNode root, String... keys) {
        for (String key : keys) {
            if (root.has(key) && !root.get(key).isNull()) {
                String v = root.get(key).asText("").trim();
                if (!v.isEmpty()) {
                    return v;
                }
            }
        }
        return null;
    }

    private static List<Map<String, String>> parseCorrections(JsonNode arr) {
        List<Map<String, String>> out = new ArrayList<>();
        if (arr == null || !arr.isArray()) {
            return out;
        }
        for (JsonNode item : arr) {
            if (item != null && item.isObject()) {
                String from = item.path("from").asText("").trim();
                String to = item.path("to").asText("").trim();
                if (!from.isEmpty() && !to.isEmpty()) {
                    Map<String, String> m = new LinkedHashMap<>();
                    m.put("from", from);
                    m.put("to", to);
                    out.add(m);
                }
            }
        }
        return out;
    }

    private static void mergeCorrections(List<Map<String, String>> target, List<Map<String, String>> extra) {
        if (extra == null || extra.isEmpty()) {
            return;
        }
        for (Map<String, String> item : extra) {
            if (!target.contains(item)) {
                target.add(item);
            }
        }
    }
}
