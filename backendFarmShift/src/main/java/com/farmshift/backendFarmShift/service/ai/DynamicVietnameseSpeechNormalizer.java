package com.farmshift.backendFarmShift.service.ai;

import com.farmshift.backendFarmShift.repository.BarnRepository;
import com.farmshift.backendFarmShift.repository.BrandRepository;
import com.farmshift.backendFarmShift.repository.FarmAreaRepository;
import com.farmshift.backendFarmShift.repository.ProductCategoryRepository;
import com.farmshift.backendFarmShift.service.VietnameseSpeechNormalizer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

/**
 * Dynamic speech normalizer that enriches static phonetic rules with
 * live catalog entities (active barns, farm areas, feed products, and medicine brands).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DynamicVietnameseSpeechNormalizer {

    private final BarnRepository barnRepository;
    private final FarmAreaRepository areaRepository;
    private final ProductCategoryRepository productCategoryRepository;
    private final BrandRepository brandRepository;

    private volatile long lastRefreshed = 0L;
    private static final long CACHE_TTL_MILLIS = 10 * 60 * 1000L; // 10 minutes

    private final Set<String> knownBarnNames = ConcurrentHashMap.newKeySet();
    private final Set<String> knownProductNames = ConcurrentHashMap.newKeySet();

    public String normalize(String rawMessage) {
        if (rawMessage == null || rawMessage.isBlank()) {
            return "";
        }

        // 1. Base static Vietnamese normalization (numbers, units, abbreviations, homophones)
        String normalized = VietnameseSpeechNormalizer.normalizeVietnameseCommand(rawMessage);

        // 2. Refresh dynamic vocabulary if TTL expired
        refreshIfNeeded();

        // 3. Dynamic entity alignment
        return alignDynamicEntities(normalized);
    }

    private synchronized void refreshIfNeeded() {
        long now = System.currentTimeMillis();
        if (now - lastRefreshed > CACHE_TTL_MILLIS || knownBarnNames.isEmpty()) {
            try {
                knownBarnNames.clear();
                barnRepository.findAll().forEach(b -> {
                    if (b.getName() != null && !b.getName().isBlank()) {
                        knownBarnNames.add(b.getName().trim());
                    }
                });

                knownProductNames.clear();
                productCategoryRepository.findAll().forEach(p -> {
                    if (p.getName() != null && !p.getName().isBlank()) {
                        knownProductNames.add(p.getName().trim());
                    }
                });
                lastRefreshed = now;
                log.debug("Refreshed dynamic AI speech vocabulary: {} barns, {} products",
                        knownBarnNames.size(), knownProductNames.size());
            } catch (Exception ex) {
                log.warn("Could not refresh dynamic AI vocabulary: {}", ex.getMessage());
            }
        }
    }

    private String alignDynamicEntities(String text) {
        String result = text;
        for (String barn : knownBarnNames) {
            String lowerBarn = barn.toLowerCase(Locale.ROOT);
            String regex = "(?i)\\b" + Pattern.quote(lowerBarn) + "\\b";
            result = result.replaceAll(regex, barn);
        }
        return result;
    }
}

