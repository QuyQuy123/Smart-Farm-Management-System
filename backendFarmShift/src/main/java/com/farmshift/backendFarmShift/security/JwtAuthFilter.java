package com.farmshift.backendFarmShift.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Intercepts every HTTP request exactly once and validates the JWT from the
 * {@code Authorization: Bearer <token>} header.
 *
 * <p>Roles are read directly from the token claims — no DB call on each request.</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtProvider jwtProvider;

    @Autowired(required = false)
    private AccountAuthStateService accountAuthStateService;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain chain) throws ServletException, IOException {

        String token = extractToken(request);

        if (StringUtils.hasText(token) && jwtProvider.validateToken(token)) {

            String email          = jwtProvider.getEmailFromToken(token);
            List<String> roles    = jwtProvider.getRolesFromToken(token);
            Long issuedAtMs       = jwtProvider.getIssuedAtMillisFromToken(token);

            List<String> effectiveRoles = roles;
            boolean authorized = true;
            if (accountAuthStateService != null) {
                var resolved = accountAuthStateService.resolveAuthorizedRoles(email, issuedAtMs, roles);
                if (resolved.isEmpty()) {
                    authorized = false;
                } else {
                    effectiveRoles = resolved.get();
                }
            }

            if (authorized) {
                List<SimpleGrantedAuthority> authorities = (effectiveRoles != null ? effectiveRoles : List.<String>of()).stream()
                        .map(SimpleGrantedAuthority::new)
                        .toList();

                UsernamePasswordAuthenticationToken authentication =
                        new UsernamePasswordAuthenticationToken(email, null, authorities);
                authentication.setDetails(
                        new WebAuthenticationDetailsSource().buildDetails(request));

                // Publish to security context — downstream @PreAuthorize checks will see it
                SecurityContextHolder.getContext().setAuthentication(authentication);
            }
        }

        chain.doFilter(request, response);
    }

    /** Extracts the raw token from "Authorization: Bearer <token>". */
    private String extractToken(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (StringUtils.hasText(header) && header.startsWith("Bearer ")) {
            return header.substring(7);
        }
        return null;
    }
}
