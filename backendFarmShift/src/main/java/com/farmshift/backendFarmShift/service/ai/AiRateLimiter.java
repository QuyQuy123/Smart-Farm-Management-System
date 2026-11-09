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

    private final Map<String, Deque<Long>> transcribeTimestamps = new ConcurrentHashMap<>();
    private final Map<String, Deque<Long>> chatTimestamps = new ConcurrentHashMap<>();

    public synchronized boolean tryAcquireTranscribe(String userKey) {
        String key = (userKey != null && !userKey.isBlank()) ? userKey : "anonymous";
        return tryAcquire(transcribeTimestamps, key, MAX_TRANSCRIBE_PER_MINUTE);
    }

    public synchronized boolean tryAcquireChat(String userKey) {
        String key = (userKey != null && !userKey.isBlank()) ? userKey : "anonymous";
        return tryAcquire(chatTimestamps, key, MAX_CHAT_PER_MINUTE);
    }

    private boolean tryAcquire(Map<String, Deque<Long>> registry, String key, int maxAllowed) {
        long now = Instant.now().toEpochMilli();
        Deque<Long> timestamps = registry.computeIfAbsent(key, k -> new ArrayDeque<>());

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

    public synchronized void reset(String userKey) {
        if (userKey != null) {
            transcribeTimestamps.remove(userKey);
            chatTimestamps.remove(userKey);
        }
    }

    public synchronized void resetAll() {
        transcribeTimestamps.clear();
        chatTimestamps.clear();
    }
}

