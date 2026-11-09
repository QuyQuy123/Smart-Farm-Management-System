package com.farmshift.backendFarmShift.controller;

import com.farmshift.backendFarmShift.dto.AiAssistantRequest;
import com.farmshift.backendFarmShift.dto.AiAssistantResponse;
import com.farmshift.backendFarmShift.dto.SpeechTranscribeResponse;
import com.farmshift.backendFarmShift.service.AiAssistantService;
import com.farmshift.backendFarmShift.service.GroqWhisperService;
import com.farmshift.backendFarmShift.service.ai.AiRateLimiter;
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

import java.util.concurrent.CompletableFuture;

@Slf4j
@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiAssistantController {

    private final GroqWhisperService whisperService;
    private final AiAssistantService assistantService;
    private final AiRateLimiter rateLimiter;

    @PostMapping(value = "/transcribe", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<SpeechTranscribeResponse> transcribe(@RequestParam(value = "file", required = false) MultipartFile file,
                                                               Authentication authentication) {
        String username = authentication != null ? authentication.getName() : "anonymous";
        if (!rateLimiter.tryAcquireTranscribe(username)) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(SpeechTranscribeResponse.builder()
                            .text("⚠️ Quá nhiều yêu cầu nhận diện giọng nói trong thời gian ngắn (tối đa 20 yêu cầu/phút). Vui lòng thử lại sau giây lát.")
                            .fallback(true)
                            .durationMs(0L)
                            .build());
        }

        SpeechTranscribeResponse response = whisperService.transcribe(file);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/assistant")
    public ResponseEntity<AiAssistantResponse> handleAssistantRequest(
            @Valid @RequestBody AiAssistantRequest request,
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
        return ResponseEntity.ok(response);
    }

    @PostMapping(value = "/assistant/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamAssistantPost(
            @Valid @RequestBody AiAssistantRequest request,
            Authentication authentication
    ) {
        return createAssistantSseEmitter(request, authentication);
    }

    @GetMapping(value = "/assistant/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamAssistantGet(
            @RequestParam("message") String message,
            @RequestParam(value = "currentRoute", required = false) String currentRoute,
            Authentication authentication
    ) {
        AiAssistantRequest request = AiAssistantRequest.builder()
                .message(message)
                .currentRoute(currentRoute)
                .build();
        return createAssistantSseEmitter(request, authentication);
    }

    private SseEmitter createAssistantSseEmitter(
            AiAssistantRequest request,
            Authentication authentication
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
