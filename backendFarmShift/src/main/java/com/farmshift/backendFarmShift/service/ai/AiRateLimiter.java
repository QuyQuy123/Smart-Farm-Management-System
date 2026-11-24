package com.farmshift.backendFarmShift.service.ai;

import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Token-bucket sliding-window rate limiter per user / client key.
 * Enforces:
 * - Voice Transcribe: max 20 requests / minute / user.
 * - Assistant Chat: max 30 requests / minute / user.
 */
@Component
public class AiRateLimiter {

    public static final int MAX_TRANSCRIBE_PER_MINUTE = 20;
    public static final int MAX_CHAT_PER_MINUTE = 30;
    private static final long ONE_MINUTE_MILLIS = 60_000L;

    private static final int MAX_RATE_KEYS = 2_000;

    private final Map<String, Deque<Long>> transcribeTimestamps = new ConcurrentHashMap<>();
    private final Map<String, Deque<Long>> chatTimestamps = new ConcurrentHashMap<>();

    public boolean tryAcquireTranscribe(String userKey) {
        String key = (userKey != null && !userKey.isBlank()) ? userKey : "anonymous";
        return tryAcquire(transcribeTimestamps, key, MAX_TRANSCRIBE_PER_MINUTE);
    }

    public boolean tryAcquireChat(String userKey) {
        String key = (userKey != null && !userKey.isBlank()) ? userKey : "anonymous";
        return tryAcquire(chatTimestamps, key, MAX_CHAT_PER_MINUTE);
    }

    private boolean tryAcquire(Map<String, Deque<Long>> registry, String key, int maxAllowed) {
        if (registry.size() >= MAX_RATE_KEYS && !registry.containsKey(key)) {
            long cutoff = Instant.now().toEpochMilli() - ONE_MINUTE_MILLIS;
            registry.entrySet().removeIf(entry -> {
                Deque<Long> q = entry.getValue();
                synchronized (q) {
                    while (!q.isEmpty() && q.peekFirst() < cutoff) {
                        q.pollFirst();
                    }
                    return q.isEmpty();
                }
            });
        }
        long now = Instant.now().toEpochMilli();
        Deque<Long> timestamps = registry.computeIfAbsent(key, k -> new ArrayDeque<>());

        synchronized (timestamps) {
            // Evict timestamps older than 60 seconds
            while (!timestamps.isEmpty() && (now - timestamps.peekFirst()) > ONE_MINUTE_MILLIS) {
                timestamps.pollFirst();
            }

            if (timestamps.size() >= maxAllowed) {
                return false;
            }

            timestamps.addLast(now);
            return true;
        }
    }

    public void reset(String userKey) {
        if (userKey != null) {
            transcribeTimestamps.remove(userKey);
            chatTimestamps.remove(userKey);
        }
    }

    public void resetAll() {
        transcribeTimestamps.clear();
        chatTimestamps.clear();
    }
}

