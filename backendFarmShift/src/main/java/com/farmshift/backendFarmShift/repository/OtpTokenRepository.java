package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.OtpToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;

@Repository
public interface OtpTokenRepository extends JpaRepository<OtpToken, Long> {

    /**
     * Find the most recently issued, valid (not used, not expired) OTP for an email.
     */
    Optional<OtpToken> findTopByEmailAndUsedFalseAndExpiresAtAfterOrderByCreatedAtDesc(
            String email, LocalDateTime now);

    /**
     * Invalidate all existing OTPs for a given email before issuing a new one.
     * Prevents multi-token abuse.
     */
    @Modifying
    @Transactional
    @Query("UPDATE OtpToken o SET o.used = true WHERE o.email = :email AND o.used = false")
    void invalidateAllByEmail(@Param("email") String email);
}
