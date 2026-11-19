package com.farmshift.backendFarmShift.controller;

import com.farmshift.backendFarmShift.dto.AiAssistantRequest;
import com.farmshift.backendFarmShift.dto.AiAssistantResponse;
import com.farmshift.backendFarmShift.dto.AiSuggestionResponse;
import com.farmshift.backendFarmShift.dto.SpeechTranscribeResponse;
import com.farmshift.backendFarmShift.service.AiAssistantService;
import com.farmshift.backendFarmShift.service.GroqWhisperService;
import com.farmshift.backendFarmShift.service.RealtimeSyncService;
import com.farmshift.backendFarmShift.service.ai.AiRateLimiter;
import com.farmshift.backendFarmShift.service.ai.AiSuggestionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.CompletableFuture;

@Slf4j
@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiAssistantController {

    private static final long MAX_VOICE_BYTES = 10L * 1024L * 1024L;
    private static final Set<String> ALLOWED_AUDIO_MIMES = Set.of(
            "audio/webm", "audio/mp4", "audio/mpeg", "audio/mp3",
            "audio/ogg", "audio/wav", "audio/x-wav", "audio/wave",
            "audio/x-m4a", "audio/m4a", "audio/aac"
    );
    private static final Set<String> ALLOWED_AUDIO_EXTS = Set.of(
            ".webm", ".mp4", ".m4a", ".ogg", ".wav", ".mp3", ".aac"
    );

    private final GroqWhisperService whisperService;
    private final AiAssistantService assistantService;
    private final AiRateLimiter rateLimiter;
    private final RealtimeSyncService realtimeSyncService;
    private final AiSuggestionService suggestionService;

    @GetMapping("/suggestions")
    public ResponseEntity<AiSuggestionResponse> getSuggestions(
            @RequestParam(value = "route", required = false) String route,
            Authentication authentication
    ) {
        String username = authentication != null ? authentication.getName() : "anonymous";
        var authorities = authentication != null ? authentication.getAuthorities() : null;
        return ResponseEntity.ok(suggestionService.getSuggestions(username, authorities, route));
    }

    @PostMapping(value = {"/transcribe", "/voice/transcribe"}, consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<SpeechTranscribeResponse> transcribe(
            @RequestParam(value = "file", required = false) MultipartFile file,
            Authentication authentication) {
        String username = authentication != null ? authentication.getName() : "anonymous";
        if (!rateLimiter.tryAcquireTranscribe(username)) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(SpeechTranscribeResponse.builder()
                            .text("⚠️ Quá nhiều yêu cầu nhận diện giọng nói trong thời gian ngắn (tối đa 20 yêu cầu/phút). Vui lòng thử lại sau giây lát.")
                            .rawText("")
                            .normalizedText("")
                            .confidence(0.0)
                            .autoSubmitEligible(false)
                            .rejectedReason("RATE_LIMIT_EXCEEDED")
                            .corrections(List.of())
                            .segmentsFiltered(0)
                            .fallback(true)
                            .durationMs(0L)
                            .build());
        }

        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(SpeechTranscribeResponse.builder()
                            .text("")
                            .rawText("")
                            .normalizedText("")
                            .confidence(0.0)
                            .autoSubmitEligible(false)
                            .rejectedReason("EMPTY_AUDIO")
                            .corrections(List.of())
                            .segmentsFiltered(0)
                            .provider("VALIDATION_GUARD")
                            .fallback(false)
                            .durationMs(0L)
                            .build());
        }

        if (file.getSize() > MAX_VOICE_BYTES) {
            return ResponseEntity.badRequest()
                    .body(SpeechTranscribeResponse.builder()
                            .text("")
                            .rawText("")
                            .normalizedText("")
                            .confidence(0.0)
                            .autoSubmitEligible(false)
                            .rejectedReason("FILE_TOO_LARGE")
                            .corrections(List.of())
                            .segmentsFiltered(0)
                            .provider("VALIDATION_GUARD")
                            .fallback(false)
                            .durationMs(0L)
                            .build());
        }

        if (!isAllowedAudioMime(file.getContentType(), file.getOriginalFilename())) {
            return ResponseEntity.badRequest()
                    .body(SpeechTranscribeResponse.builder()
                            .text("")
                            .rawText("")
                            .normalizedText("")
                            .confidence(0.0)
                            .autoSubmitEligible(false)
                            .rejectedReason("INVALID_AUDIO_MIME")
                            .corrections(List.of())
                            .segmentsFiltered(0)
                            .provider("VALIDATION_GUARD")
                            .fallback(false)
                            .durationMs(0L)
                            .build());
        }

        var authorities = authentication != null ? authentication.getAuthorities() : null;
        SpeechTranscribeResponse response = whisperService.transcribe(file, username, authorities);
        return ResponseEntity.ok(response);
    }

    private static boolean isAllowedAudioMime(String contentType, String originalFilename) {
        if (contentType == null || contentType.isBlank()) {
            return false;
        }
        String baseMime = contentType.split(";")[0].trim().toLowerCase(Locale.ROOT);
        if (ALLOWED_AUDIO_MIMES.contains(baseMime)) {
            return true;
        }
        if ("application/octet-stream".equals(baseMime) && originalFilename != null) {
            String lowerName = originalFilename.trim().toLowerCase(Locale.ROOT);
            return ALLOWED_AUDIO_EXTS.stream().anyMatch(lowerName::endsWith);
        }
        return false;
    }

    @PostMapping({"/assistant", "/chat"})
    public ResponseEntity<AiAssistantResponse> handleAssistantRequest(
            @Valid @RequestBody AiAssistantRequest request,
            @RequestHeader(value = "X-Client-Id", required = false) String clientId,
            Authentication authentication
    ) {
        String username = authentication != null ? authentication.getName() : "Người dùng";
        var authorities = authentication != null ? authentication.getAuthorities() : null;

        if (!rateLimiter.tryAcquireChat(username)) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(AiAssistantResponse.builder()
                            .reply("⚠️ Quá nhiều yêu cầu gửi tới Trợ lý AI trong thời gian ngắn (tối đa 30 yêu cầu/phút). Vui lòng thử lại sau giây lát.")
                            .actionType("RATE_LIMIT_EXCEEDED")
                            .executed(false)
                            .build());
        }

        AiAssistantResponse response = assistantService.processRequest(request, username, authorities);
        if (response.isExecuted()) {
            realtimeSyncService.broadcastDataChange("/all", "AI", username, clientId);
        }
        if (response.getActionType() != null && response.getActionType().startsWith("SECURITY_TOKEN_")) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(response);
        }
        return ResponseEntity.ok(response);
    }

    @PostMapping("/confirm")
    public ResponseEntity<AiAssistantResponse> confirmAssistantAction(
            @Valid @RequestBody AiAssistantRequest request,
            @RequestHeader(value = "X-Client-Id", required = false) String clientId,
            Authentication authentication
    ) {
        request.setConfirmAction(true);
        return handleAssistantRequest(request, clientId, authentication);
    }

    @PostMapping(value = "/assistant/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamAssistantPost(
            @Valid @RequestBody AiAssistantRequest request,
            @RequestHeader(value = "X-Client-Id", required = false) String clientId,
            Authentication authentication
    ) {
        return createAssistantSseEmitter(request, authentication, clientId);
    }

    @GetMapping(value = "/assistant/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamAssistantGet(
            @RequestParam("message") String message,
            @RequestParam(value = "currentRoute", required = false) String currentRoute,
            @RequestHeader(value = "X-Client-Id", required = false) String clientId,
            Authentication authentication
    ) {
        AiAssistantRequest request = AiAssistantRequest.builder()
                .message(message)
                .currentRoute(currentRoute)
                .build();
        return createAssistantSseEmitter(request, authentication, clientId);
    }

    private SseEmitter createAssistantSseEmitter(
            AiAssistantRequest request,
            Authentication authentication,
            String clientId
    ) {
        SseEmitter emitter = new SseEmitter(60_000L);
        String username = authentication != null ? authentication.getName() : "Người dùng";
        var authorities = authentication != null ? authentication.getAuthorities() : null;

        if (!rateLimiter.tryAcquireChat(username)) {
            try {
                emitter.send(SseEmitter.event()
                        .name("error")
                        .data(AiAssistantResponse.builder()
                                .reply("⚠️ Quá nhiều yêu cầu gửi tới Trợ lý AI (tối đa 30 yêu cầu/phút). Vui lòng thử lại sau.")
                                .actionType("RATE_LIMIT_EXCEEDED")
                                .executed(false)
                                .build()));
                emitter.complete();
            } catch (Exception ignored) {}
            return emitter;
        }

        CompletableFuture.runAsync(() -> {
            try {
                AiAssistantResponse response = assistantService.processRequest(request, username, authorities);
                if (response.isExecuted()) {
                    realtimeSyncService.broadcastDataChange("/all", "AI", username, clientId);
                }
                String text = response.getReply() != null ? response.getReply() : "";
                String[] words = text.split(" ");
                for (String word : words) {
                    emitter.send(SseEmitter.event().name("token").data(word + " "));
                    Thread.sleep(20);
                }
                emitter.send(SseEmitter.event().name("done").data(response));
                emitter.complete();
            } catch (Exception ex) {
                emitter.completeWithError(ex);
            }
        });

        return emitter;
    }
}
