package com.farmshift.backendFarmShift.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * Data Flywheel entity logging AI Chatbot interactions, routing tiers, extracted payloads,
 * HITL confirmation outcomes, and user feedback ratings for continuous evaluation & SFT/LoRA training.
 */
@Entity
@Table(name = "ai_interaction_logs")
@Data
public class AiInteractionLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "request_id", nullable = false, length = 64)
    private String requestId;

    @Column(name = "session_id", length = 128)
    private String sessionId;

    @Column(name = "account_id")
    private Long accountId;

    @Column(nullable = false, length = 100)
    private String username;

    @Column(name = "user_role", nullable = false, length = 30)
    private String userRole;

    @Column(name = "current_route", length = 255)
    private String currentRoute;

    @Column(name = "raw_message", nullable = false, columnDefinition = "TEXT")
    private String rawMessage;

    @Column(name = "normalized_message", columnDefinition = "TEXT")
    private String normalizedMessage;

    @Column(length = 80)
    private String intent;

    @Column(name = "handler_tier", length = 50)
    private String handlerTier;

    @Column(length = 80)
    private String provider;

    private Double confidence;

    @Column(nullable = false)
    private boolean executed = false;

    @Column(name = "requires_confirmation", nullable = false)
    private boolean requiresConfirmation = false;

    private Boolean confirmed;

    @Column(name = "latency_ms", nullable = false)
    private long latencyMs = 0L;

    @Column(name = "reply_preview", length = 1000)
    private String replyPreview;

    @Column(name = "extracted_payload", columnDefinition = "TEXT")
    private String extractedPayload;

    @Column(name = "feedback_rating")
    private Short feedbackRating;

    @Column(name = "feedback_note", length = 500)
    private String feedbackNote;

    @Column(name = "feedback_corrected_intent", length = 80)
    private String feedbackCorrectedIntent;

    @Column(name = "feedback_at")
    private LocalDateTime feedbackAt;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}
