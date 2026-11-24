package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.AiInteractionLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface AiInteractionLogRepository extends JpaRepository<AiInteractionLog, Long> {

    List<AiInteractionLog> findTop500ByOrderByCreatedAtDescIdDesc();

    List<AiInteractionLog> findByFeedbackRatingNotNullOrderByCreatedAtDescIdDesc();

    Optional<AiInteractionLog> findFirstBySessionIdAndUsernameAndRequiresConfirmationTrueOrderByCreatedAtDescIdDesc(
            String sessionId,
            String username
    );

    long countByFeedbackRating(Short feedbackRating);

    long countByRequiresConfirmationTrue();

    long countByConfirmedTrue();

    @Query("SELECT COALESCE(AVG(l.latencyMs), 0) FROM AiInteractionLog l")
    Double findAverageLatencyMs();
}
