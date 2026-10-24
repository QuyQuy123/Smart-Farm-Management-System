package com.farmshift.backendFarmShift.controller;

import com.farmshift.backendFarmShift.dto.AiAssistantRequest;
import com.farmshift.backendFarmShift.dto.AiAssistantResponse;
import com.farmshift.backendFarmShift.dto.SpeechTranscribeResponse;
import com.farmshift.backendFarmShift.service.AiAssistantService;
import com.farmshift.backendFarmShift.service.GroqWhisperService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@Slf4j
@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiAssistantController {

    private final GroqWhisperService whisperService;
    private final AiAssistantService assistantService;

    @PostMapping(value = "/transcribe", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<SpeechTranscribeResponse> transcribe(@RequestParam(value = "file", required = false) MultipartFile file) {
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

        AiAssistantResponse response = assistantService.processRequest(request, username, authorities);
        return ResponseEntity.ok(response);
    }
}
