package com.farmshift.backendFarmShift.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.util.Date;
import java.util.List;

/**
 * Central JWT utility.
 *
 * <p>Signs tokens with HS256 using a Base64-encoded 256-bit secret injected from
 * {@code application.properties}. Uses the JJWT 0.12.x fluent API.</p>
 *
 * <ul>
 *   <li>Claims stored: {@code sub} (email), {@code roles} (list), {@code iat}, {@code exp}</li>
 *   <li>Default expiry: 24 hours (configurable via {@code jwt.expiration-ms})</li>
 * </ul>
 */
@Slf4j
@Component
public class JwtProvider {

    private final SecretKey secretKey;
    private final long expirationMs;

    public JwtProvider(
            @Value("${jwt.secret}") String base64Secret,
            @Value("${jwt.expiration-ms:86400000}") long expirationMs) {

        this.secretKey = Keys.hmacShaKeyFor(Decoders.BASE64.decode(base64Secret));
        this.expirationMs = expirationMs;
    }

    // ------------------------------------------------------------------ generate

    /**
     * Build a signed JWT from an authenticated {@link Authentication} object.
     * Roles are encoded as a JSON array claim so the filter can reconstruct authorities
     * without an extra DB round-trip.
     */
    public String generateToken(Authentication authentication) {
        String email = authentication.getName();
        List<String> roles = authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .toList();

        Date now    = new Date();
        Date expiry = new Date(now.getTime() + expirationMs);

        return Jwts.builder()
                .subject(email)
                .claim("roles", roles)
                .issuedAt(now)
                .expiration(expiry)
                .signWith(secretKey)          // JJWT 0.12 auto-selects HS256 for SecretKey
                .compact();
    }

    // ------------------------------------------------------------------ extract

    public String getEmailFromToken(String token) {
        return parseClaims(token).getSubject();
    }

    @SuppressWarnings("unchecked")
    public List<String> getRolesFromToken(String token) {
        return (List<String>) parseClaims(token).get("roles");
    }

    // ------------------------------------------------------------------ validate

    /**
     * Returns {@code true} only if the token is well-formed, signed by this server,
     * and not yet expired.
     */
    public boolean validateToken(String token) {
        try {
            parseClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException ex) {
            log.warn("JWT validation failed: {}", ex.getMessage());
            return false;
        }
    }

    // ------------------------------------------------------------------ internal

    private Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith(secretKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
