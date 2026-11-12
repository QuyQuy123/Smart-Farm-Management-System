package com.farmshift.backendFarmShift.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Lightweight in-memory token-bucket HTTP rate limiter to protect Tomcat threads,
 * BCrypt authentication endpoints, and PostgreSQL connections against request floods.
 */
@Slf4j
@Component
public class HttpRateLimitFilter extends OncePerRequestFilter {

    private static final int MAX_BUCKETS = 10_000;
    private static final long STALE_BUCKET_NANOS = TimeUnit.MINUTES.toNanos(5);
    private static final int CLEANUP_INTERVAL = 1_024;

    private final boolean enabled;
    private final ConcurrentHashMap<String, TokenBucket> buckets = new ConcurrentHashMap<>();
    private final AtomicInteger requestCounter = new AtomicInteger();

    public HttpRateLimitFilter(@Value("${app.rate-limit.enabled:true}") boolean enabled) {
        this.enabled = enabled;
    }

    enum Tier {
        AUTH(20.0, 0.5),
        AI(30.0, 1.0),
        HEALTH(200.0, 100.0),
        API(150.0, 80.0);

        final double capacity;
        final double refillPerSecond;

        Tier(double capacity, double refillPerSecond) {
            this.capacity = capacity;
            this.refillPerSecond = refillPerSecond;
        }
    }

    private static final class TokenBucket {
        double tokens;
        long lastRefillNanos;
        volatile long lastSeenNanos;

        TokenBucket(double capacity, long nowNanos) {
            this.tokens = capacity;
            this.lastRefillNanos = nowNanos;
            this.lastSeenNanos = nowNanos;
        }

        synchronized long tryConsume(double capacity, double refillPerSecond, long nowNanos) {
            long elapsedNanos = Math.max(0L, nowNanos - lastRefillNanos);
            if (elapsedNanos > 0L) {
                double replenished = (elapsedNanos / 1_000_000_000.0) * refillPerSecond;
                tokens = Math.min(capacity, tokens + replenished);
                lastRefillNanos = nowNanos;
            }
            lastSeenNanos = nowNanos;
            if (tokens >= 1.0) {
                tokens -= 1.0;
                return 0L;
            }
            double deficit = 1.0 - tokens;
            return Math.max(1L, (long) Math.ceil(deficit / refillPerSecond));
        }
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {

        if (!enabled || HttpMethod.OPTIONS.matches(request.getMethod())) {
            filterChain.doFilter(request, response);
            return;
        }

        String path = resolvePath(request);
        Tier tier = resolveTier(path);
        String clientIp = request.getRemoteAddr() != null ? request.getRemoteAddr() : "unknown";
        String key = tier.name() + ":" + clientIp;
        long nowNanos = System.nanoTime();

        maybeCleanup(nowNanos);

        TokenBucket bucket = buckets.computeIfAbsent(key, ignored -> new TokenBucket(tier.capacity, nowNanos));
        long retryAfterSeconds = bucket.tryConsume(tier.capacity, tier.refillPerSecond, nowNanos);

        if (retryAfterSeconds > 0L) {
            log.debug("Rate limit exceeded on tier={} path={} ip={}", tier, path, clientIp);
            response.setStatus(429);
            response.setCharacterEncoding(StandardCharsets.UTF_8.name());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setHeader("Retry-After", String.valueOf(retryAfterSeconds));
            response.getWriter().write(
                    "{\"success\":false,\"message\":\"Quá nhiều yêu cầu từ địa chỉ của bạn. Vui lòng thử lại sau giây lát.\"}"
            );
            return;
        }

        filterChain.doFilter(request, response);
    }

    private Tier resolveTier(String path) {
        if (path.startsWith("/api/auth/")) {
            return Tier.AUTH;
        }
        if (path.startsWith("/api/ai/")) {
            return Tier.AI;
        }
        if ("/health".equals(path) || "/api/health".equals(path) || "/actuator/health".equals(path)) {
            return Tier.HEALTH;
        }
        return Tier.API;
    }

    private String resolvePath(HttpServletRequest request) {
        String uri = request.getRequestURI();
        String ctx = request.getContextPath();
        if (ctx != null && !ctx.isEmpty() && uri.startsWith(ctx)) {
            return uri.substring(ctx.length());
        }
        return uri != null ? uri : "/";
    }

    private void maybeCleanup(long nowNanos) {
        if ((requestCounter.incrementAndGet() % CLEANUP_INTERVAL) != 0 && buckets.size() < MAX_BUCKETS) {
            return;
        }
        Iterator<Map.Entry<String, TokenBucket>> it = buckets.entrySet().iterator();
        while (it.hasNext()) {
            Map.Entry<String, TokenBucket> entry = it.next();
            if (nowNanos - entry.getValue().lastSeenNanos > STALE_BUCKET_NANOS) {
                it.remove();
            }
        }
        if (buckets.size() >= MAX_BUCKETS) {
            int toDrop = buckets.size() - (MAX_BUCKETS / 2);
            Iterator<String> keyIt = buckets.keySet().iterator();
            while (keyIt.hasNext() && toDrop > 0) {
                keyIt.next();
                keyIt.remove();
                toDrop--;
            }
        }
    }
}

