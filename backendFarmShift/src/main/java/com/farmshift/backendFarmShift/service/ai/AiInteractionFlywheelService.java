package com.farmshift.backendFarmShift.service.ai;

import com.farmshift.backendFarmShift.dto.AiAssistantResponse;
import com.farmshift.backendFarmShift.dto.request.AiFeedbackRequest;
import com.farmshift.backendFarmShift.entity.Account;
import com.farmshift.backendFarmShift.entity.AiInteractionLog;
import com.farmshift.backendFarmShift.exception.BadRequestException;
import com.farmshift.backendFarmShift.exception.ResourceNotFoundException;
import com.farmshift.backendFarmShift.repository.AccountRepository;
import com.farmshift.backendFarmShift.repository.AiInteractionLogRepository;
import com.farmshift.backendFarmShift.service.CycleService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.Pattern;

/**
 * Data Flywheel service capturing AI interaction telemetry, user feedback (+1/-1),
 * confirmation outcomes, and curated SFT/LoRA training dataset export.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AiInteractionFlywheelService {

    private static final Pattern SECRET_REDACT_PATTERN = Pattern.compile(
            "(?iu)(?:JWT_SECRET|VAPID_PRIVATE_KEY|AI_INTERNAL_TOKEN|OPENAI_API_KEY|GROQ_API_KEY)\\s*[:=]?\\s*\\S+"
    );
    private static final Set<String> STRIPPED_PAYLOAD_KEYS = Set.of("actionToken", "actionId", "expiresAt");

    private final AiInteractionLogRepository logRepository;
    private final AccountRepository accountRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public Long recordInteraction(
            String requestId,
            String sessionId,
            String username,
            String userRole,
            String currentRoute,
            String rawMessage,
            String normalizedMessage,
            String handlerTier,
            String provider,
            Double confidence,
            long latencyMs,
            AiAssistantResponse response
    ) {
        if (response == null || rawMessage == null || rawMessage.isBlank()) {
            return null;
        }
        try {
            String safeUser = truncate(username != null && !username.isBlank() ? username.trim() : "anonymous", 100);
            Long accountId = accountRepository.findByEmail(safeUser.toLowerCase(Locale.ROOT))
                    .or(() -> accountRepository.findByEmail(safeUser))
                    .map(Account::getId)
                    .orElse(null);

            AiInteractionLog entry = new AiInteractionLog();
            entry.setRequestId(truncate(requestId != null && !requestId.isBlank() ? requestId : UUID.randomUUID().toString(), 64));
            entry.setSessionId(truncate(sessionId, 128));
            entry.setAccountId(accountId);
            entry.setUsername(safeUser);
            entry.setUserRole(truncate(userRole != null && !userRole.isBlank() ? userRole : "ROLE_FARM_WORKER", 30));
            entry.setCurrentRoute(truncate(currentRoute, 255));
            entry.setRawMessage(redactSecrets(rawMessage));
            entry.setNormalizedMessage(normalizedMessage != null ? redactSecrets(normalizedMessage) : null);
            entry.setIntent(truncate(response.getActionType(), 80));
            entry.setHandlerTier(truncate(handlerTier, 50));
            entry.setProvider(truncate(provider, 80));
            entry.setConfidence(confidence);
            entry.setExecuted(response.isExecuted());
            entry.setRequiresConfirmation(response.isRequiresConfirmation());
            entry.setConfirmed(null);
            entry.setLatencyMs(Math.max(0L, latencyMs));
            entry.setReplyPreview(truncate(redactSecrets(response.getReply()), 1000));
            entry.setExtractedPayload(serializeSanitizedPayload(response));
            entry.setCreatedAt(LocalDateTime.now(CycleService.VN_ZONE));

            AiInteractionLog saved = logRepository.save(entry);
            return saved.getId();
        } catch (Exception ex) {
            log.warn("Could not persist AI interaction log: {}", ex.getMessage());
            return null;
        }
    }

    @Transactional
    public void markLatestPendingConfirmation(String sessionId, String username, boolean confirmed) {
        if (sessionId == null || username == null) {
            return;
        }
        try {
            logRepository.findFirstBySessionIdAndUsernameAndRequiresConfirmationTrueOrderByCreatedAtDescIdDesc(
                            sessionId, username)
                    .ifPresent(entry -> {
                        if (entry.getConfirmed() == null) {
                            entry.setConfirmed(confirmed);
                            logRepository.save(entry);
                        }
                    });
        } catch (Exception ex) {
            log.debug("Could not update confirmation status on AI interaction log: {}", ex.getMessage());
        }
    }

    @Transactional
    public Map<String, Object> submitFeedback(AiFeedbackRequest req, String actor, boolean isOwner) {
        if (req.rating() == null || (req.rating() != 1 && req.rating() != -1)) {
            throw new BadRequestException("Đánh giá chỉ chấp nhận giá trị +1 (Hữu ích) hoặc -1 (Chưa đúng).");
        }
        AiInteractionLog entry = logRepository.findById(req.interactionId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lượt tương tác AI."));

        boolean sameOwner = entry.getUsername() != null
                && actor != null
                && entry.getUsername().equalsIgnoreCase(actor.trim());
        if (!isOwner && !sameOwner) {
            throw new AccessDeniedException("Bạn không có quyền đánh giá lượt tương tác AI của người khác.");
        }

        entry.setFeedbackRating(req.rating().shortValue());
        entry.setFeedbackNote(req.note() != null ? truncate(req.note().trim(), 500) : null);
        if (isOwner && req.correctedIntent() != null && !req.correctedIntent().isBlank()) {
            entry.setFeedbackCorrectedIntent(truncate(req.correctedIntent().trim().toUpperCase(Locale.ROOT), 80));
        }
        entry.setFeedbackAt(LocalDateTime.now(CycleService.VN_ZONE));
        AiInteractionLog saved = logRepository.save(entry);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("interactionId", saved.getId());
        result.put("rating", saved.getFeedbackRating());
        result.put("correctedIntent", saved.getFeedbackCorrectedIntent());
        result.put("feedbackAt", saved.getFeedbackAt() != null ? saved.getFeedbackAt().toString() : null);
        return result;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getFlywheelStats() {
        long total = logRepository.count();
        long positive = logRepository.countByFeedbackRating((short) 1);
        long negative = logRepository.countByFeedbackRating((short) -1);
        long totalPending = logRepository.countByRequiresConfirmationTrue();
        long confirmed = logRepository.countByConfirmedTrue();
        Double avgLatency = logRepository.findAverageLatencyMs();

        List<AiInteractionLog> recent = logRepository.findTop500ByOrderByCreatedAtDescIdDesc();
        Map<String, Long> byIntent = new LinkedHashMap<>();
        Map<String, Long> byTier = new LinkedHashMap<>();
        for (AiInteractionLog row : recent) {
            String intent = row.getIntent() != null ? row.getIntent() : "UNKNOWN";
            String tier = row.getHandlerTier() != null ? row.getHandlerTier() : "UNKNOWN";
            byIntent.merge(intent, 1L, Long::sum);
            byTier.merge(tier, 1L, Long::sum);
        }

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalInteractions", total);
        stats.put("positiveFeedback", positive);
        stats.put("negativeFeedback", negative);
        stats.put("feedbackCoverageRate", total > 0 ? Math.round(((positive + negative) * 1000.0) / total) / 1000.0 : 0.0);
        stats.put("positiveRate", (positive + negative) > 0 ? Math.round((positive * 1000.0) / (positive + negative)) / 1000.0 : 0.0);
        stats.put("confirmationRequests", totalPending);
        stats.put("confirmedActions", confirmed);
        stats.put("confirmationRate", totalPending > 0 ? Math.round((confirmed * 1000.0) / totalPending) / 1000.0 : 0.0);
        stats.put("avgLatencyMs", avgLatency != null ? Math.round(avgLatency) : 0L);
        stats.put("intentBreakdown", byIntent);
        stats.put("tierBreakdown", byTier);
        return stats;
    }

    @Transactional(readOnly = true)
    public String exportCuratedSftJsonl(Integer minRating, boolean includeAll) {
        Map<Long, AiInteractionLog> mergedById = new LinkedHashMap<>();
        if (!includeAll) {
            for (AiInteractionLog row : logRepository.findByFeedbackRatingNotNullOrderByCreatedAtDescIdDesc()) {
                if (row.getId() != null) {
                    mergedById.putIfAbsent(row.getId(), row);
                }
            }
        }
        for (AiInteractionLog row : logRepository.findTop500ByOrderByCreatedAtDescIdDesc()) {
            if (row.getId() != null) {
                mergedById.putIfAbsent(row.getId(), row);
            }
        }
        List<AiInteractionLog> rows = new ArrayList<>(mergedById.values());
        rows.sort(Comparator.comparing(AiInteractionLog::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder()))
                .thenComparing(AiInteractionLog::getId, Comparator.nullsLast(Comparator.reverseOrder())));
        StringBuilder sb = new StringBuilder();
        for (AiInteractionLog row : rows) {
            if ("SECURITY_BLOCKED".equalsIgnoreCase(row.getIntent())) {
                continue;
            }
            if (!includeAll) {
                boolean hasPositive = row.getFeedbackRating() != null && row.getFeedbackRating() >= (minRating != null ? minRating : 1);
                boolean hasConfirmed = Boolean.TRUE.equals(row.getConfirmed());
                boolean hasCorrection = row.getFeedbackCorrectedIntent() != null && !row.getFeedbackCorrectedIntent().isBlank();
                boolean negativeWithoutCorrection = row.getFeedbackRating() != null && row.getFeedbackRating() < 0 && !hasCorrection;
                if (negativeWithoutCorrection || (!hasPositive && !hasConfirmed && !hasCorrection)) {
                    continue;
                }
            }

            boolean hasCorrection = row.getFeedbackCorrectedIntent() != null && !row.getFeedbackCorrectedIntent().isBlank();
            String targetIntent = hasCorrection
                    ? row.getFeedbackCorrectedIntent()
                    : (row.getIntent() != null ? row.getIntent() : "GENERAL_QNA");

            Map<String, Object> targetAssistant = new LinkedHashMap<>();
            targetAssistant.put("intent", targetIntent);
            if (row.getExtractedPayload() != null && !row.getExtractedPayload().isBlank()) {
                try {
                    targetAssistant.put("arguments", objectMapper.readTree(row.getExtractedPayload()));
                } catch (Exception ignored) {
                    targetAssistant.put("arguments", Map.of());
                }
            }
            targetAssistant.put("reply", row.getReplyPreview() != null ? row.getReplyPreview() : "");

            Map<String, Object> metadata = new LinkedHashMap<>();
            metadata.put("interactionId", row.getId());
            metadata.put("userRole", row.getUserRole());
            metadata.put("handlerTier", row.getHandlerTier());
            metadata.put("provider", row.getProvider());
            metadata.put("feedbackRating", row.getFeedbackRating());
            metadata.put("confirmed", row.getConfirmed());
            metadata.put("hasCorrection", hasCorrection);
            metadata.put("source", "data_flywheel");

            Map<String, Object> record = new LinkedHashMap<>();
            try {
                record.put("messages", List.of(
                        Map.of("role", "system", "content", "FarmShift AI Assistant (" + row.getUserRole() + ")"),
                        Map.of("role", "user", "content", row.getNormalizedMessage() != null ? row.getNormalizedMessage() : row.getRawMessage()),
                        Map.of("role", "assistant", "content", objectMapper.writeValueAsString(targetAssistant))
                ));
                record.put("metadata", metadata);
                sb.append(objectMapper.writeValueAsString(record)).append('\n');
            } catch (Exception ex) {
                log.debug("Skipping malformed flywheel record id={}: {}", row.getId(), ex.getMessage());
            }
        }
        return sb.toString();
    }

    private String serializeSanitizedPayload(AiAssistantResponse response) {
        try {
            Map<String, Object> out = new LinkedHashMap<>();
            if (response.getPendingAction() != null && response.getPendingAction().get("payload") instanceof Map<?, ?> payloadMap) {
                payloadMap.forEach((k, v) -> {
                    if (k != null && !STRIPPED_PAYLOAD_KEYS.contains(String.valueOf(k))) {
                        out.put(String.valueOf(k), v);
                    }
                });
            } else if (response.getActionSummary() != null) {
                out.putAll(response.getActionSummary());
            }
            if (response.getNavigateTo() != null) {
                out.put("navigateTo", response.getNavigateTo());
            }
            return out.isEmpty() ? null : objectMapper.writeValueAsString(out);
        } catch (Exception ex) {
            return null;
        }
    }

    private static String redactSecrets(String input) {
        if (input == null) {
            return null;
        }
        return SECRET_REDACT_PATTERN.matcher(input).replaceAll("[REDACTED]");
    }

    private static String truncate(String val, int maxLen) {
        if (val == null) {
            return null;
        }
        return val.length() <= maxLen ? val : val.substring(0, maxLen);
    }
}
