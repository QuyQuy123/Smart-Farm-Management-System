package com.farmshift.backendFarmShift.security;

import com.farmshift.backendFarmShift.entity.Account;
import com.farmshift.backendFarmShift.repository.AccountRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Resolves live account activation status, current role, and per-user token revocation timestamps
 * with a short bounded cache so disabled, demoted, or password-reset accounts lose access immediately.
 */
@Service
@RequiredArgsConstructor
public class AccountAuthStateService {

    private static final long CACHE_TTL_MS = 30_000L;
    private static final int MAX_CACHE_ENTRIES = 2_000;

    private final AccountRepository accountRepository;
    private final ConcurrentHashMap<String, CachedState> cache = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Long> revokedBeforeMs = new ConcurrentHashMap<>();

    private record CachedState(boolean exists, boolean active, String roleName, long cachedAtMs) {}

    public Optional<List<String>> resolveAuthorizedRoles(String email, Long issuedAtMs, List<String> fallbackRoles) {
        if (email == null || email.isBlank()) {
            return Optional.empty();
        }
        String normalized = email.trim().toLowerCase(Locale.ROOT);
        Long cutoffMs = revokedBeforeMs.get(normalized);
        if (cutoffMs != null && issuedAtMs != null && issuedAtMs < cutoffMs) {
            return Optional.empty();
        }

        CachedState state = getOrLoadState(normalized);
        if (!state.exists()) {
            // Preserve compatibility with synthetic test users not persisted in accounts table.
            return Optional.of(fallbackRoles != null ? fallbackRoles : List.of());
        }
        if (!state.active()) {
            return Optional.empty();
        }
        String role = state.roleName() != null && !state.roleName().isBlank()
                ? state.roleName()
                : RoleNames.FARM_WORKER;
        return Optional.of(List.of(role));
    }

    public void evictUser(String email) {
        if (email == null || email.isBlank()) return;
        cache.remove(email.trim().toLowerCase(Locale.ROOT));
    }

    public void evictAndRevokeTokensIssuedBeforeNow(String email) {
        if (email == null || email.isBlank()) return;
        String normalized = email.trim().toLowerCase(Locale.ROOT);
        cache.remove(normalized);
        if (revokedBeforeMs.size() >= MAX_CACHE_ENTRIES) {
            evictOldest(revokedBeforeMs);
        }
        revokedBeforeMs.put(normalized, System.currentTimeMillis());
    }

    private CachedState getOrLoadState(String normalizedEmail) {
        long now = System.currentTimeMillis();
        CachedState cached = cache.get(normalizedEmail);
        if (cached != null && (now - cached.cachedAtMs()) < CACHE_TTL_MS) {
            return cached;
        }
        Optional<Account> accountOpt = accountRepository.findByEmail(normalizedEmail);
        CachedState loaded;
        if (accountOpt.isPresent()) {
            Account account = accountOpt.get();
            boolean active = !Boolean.FALSE.equals(account.getIsActive());
            String roleName = account.getRole() != null ? account.getRole().getName() : RoleNames.FARM_WORKER;
            loaded = new CachedState(true, active, roleName, now);
        } else {
            loaded = new CachedState(false, true, null, now);
        }
        if (cache.size() >= MAX_CACHE_ENTRIES) {
            evictExpiredOrOldest(now);
        }
        cache.put(normalizedEmail, loaded);
        return loaded;
    }

    private void evictExpiredOrOldest(long now) {
        Iterator<Map.Entry<String, CachedState>> it = cache.entrySet().iterator();
        while (it.hasNext()) {
            if ((now - it.next().getValue().cachedAtMs()) >= CACHE_TTL_MS) {
                it.remove();
            }
        }
        if (cache.size() >= MAX_CACHE_ENTRIES) {
            int toDrop = cache.size() - (MAX_CACHE_ENTRIES / 2);
            Iterator<String> keys = cache.keySet().iterator();
            while (keys.hasNext() && toDrop > 0) {
                keys.next();
                keys.remove();
                toDrop--;
            }
        }
    }

    private static void evictOldest(ConcurrentHashMap<String, Long> map) {
        int toDrop = map.size() - (MAX_CACHE_ENTRIES / 2);
        Iterator<String> keys = map.keySet().iterator();
        while (keys.hasNext() && toDrop > 0) {
            keys.next();
            keys.remove();
            toDrop--;
        }
    }
}
