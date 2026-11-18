package com.farmshift.backendFarmShift.service.ai;

import com.farmshift.backendFarmShift.repository.BarnRepository;
import com.farmshift.backendFarmShift.repository.BrandRepository;
import com.farmshift.backendFarmShift.repository.FarmAreaRepository;
import com.farmshift.backendFarmShift.repository.ProductCategoryRepository;
import com.farmshift.backendFarmShift.repository.SupplierRepository;
import com.farmshift.backendFarmShift.repository.WarehouseCategoryRepository;
import com.farmshift.backendFarmShift.service.VietnameseSpeechNormalizer;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Dynamic speech normalizer that enriches static phonetic rules with
 * live catalog entities (barns, farm areas, warehouses, products, suppliers, and brands)
 * backed by a 60-second TTL cache and explicit eviction hooks.
 */
@Slf4j
@Component
public class DynamicVietnameseSpeechNormalizer {

    private final BarnRepository barnRepository;
    private final FarmAreaRepository areaRepository;
    private final ProductCategoryRepository productCategoryRepository;
    private final BrandRepository brandRepository;
    private WarehouseCategoryRepository warehouseCategoryRepository;
    private SupplierRepository supplierRepository;

    private volatile long lastRefreshed = 0L;
    private static final long CACHE_TTL_MILLIS = 60_000L; // 60 seconds
    private static final Pattern PUNCT_WRAP = Pattern.compile("^([\\p{Punct}]*)(.*?)([\\p{Punct}]*)$");
    private static final Set<String> STOP_ENTITY_KEYS = Set.of(
            "cam", "thuoc", "nha", "chuong", "kho", "khu", "ga", "bao", "con", "kg"
    );

    private final Set<String> knownBarnNames = ConcurrentHashMap.newKeySet();
    private final Set<String> knownProductNames = ConcurrentHashMap.newKeySet();
    private final Map<String, String> plainToCanonical = new ConcurrentHashMap<>();
    private volatile int maxEntityWords = 1;

    @Autowired
    public DynamicVietnameseSpeechNormalizer(
            BarnRepository barnRepository,
            FarmAreaRepository areaRepository,
            ProductCategoryRepository productCategoryRepository,
            BrandRepository brandRepository
    ) {
        this.barnRepository = barnRepository;
        this.areaRepository = areaRepository;
        this.productCategoryRepository = productCategoryRepository;
        this.brandRepository = brandRepository;
    }

    @Autowired(required = false)
    public void setWarehouseCategoryRepository(WarehouseCategoryRepository warehouseCategoryRepository) {
        this.warehouseCategoryRepository = warehouseCategoryRepository;
    }

    @Autowired(required = false)
    public void setSupplierRepository(SupplierRepository supplierRepository) {
        this.supplierRepository = supplierRepository;
    }

    public String normalize(String rawMessage) {
        if (rawMessage == null || rawMessage.isBlank()) {
            return "";
        }

        // 1. Base static Vietnamese normalization (numbers, units, abbreviations, homophones)
        String normalized = VietnameseSpeechNormalizer.normalizeVietnameseCommand(rawMessage);

        // 2. Refresh dynamic vocabulary if TTL (60s) expired or cache evicted
        refreshIfNeeded();

        // 3. Dynamic diacritic-insensitive entity alignment
        return alignDynamicEntities(normalized);
    }

    /** Explicitly clears the cached entity lexicon so newly added DB entities take effect immediately. */
    public synchronized void evictLexiconCache() {
        lastRefreshed = 0L;
        knownBarnNames.clear();
        knownProductNames.clear();
        plainToCanonical.clear();
        maxEntityWords = 1;
    }

    public synchronized void refreshNow() {
        lastRefreshed = 0L;
        refreshIfNeeded();
    }

    public Set<String> getKnownProductNames() {
        refreshIfNeeded();
        return Set.copyOf(knownProductNames);
    }

    public Set<String> getKnownBarnNames() {
        refreshIfNeeded();
        return Set.copyOf(knownBarnNames);
    }

    private synchronized void refreshIfNeeded() {
        long now = System.currentTimeMillis();
        if (lastRefreshed == 0L || (now - lastRefreshed) > CACHE_TTL_MILLIS) {
            try {
                knownBarnNames.clear();
                knownProductNames.clear();
                plainToCanonical.clear();
                int maxWords = 1;

                if (barnRepository != null) {
                    for (var b : barnRepository.findAll()) {
                        if (b.getName() != null && !b.getName().isBlank()) {
                            String trimmed = b.getName().trim();
                            knownBarnNames.add(trimmed);
                            maxWords = Math.max(maxWords, registerEntity(trimmed));
                        }
                    }
                }
                if (areaRepository != null) {
                    for (var a : areaRepository.findAll()) {
                        if (a.getName() != null && !a.getName().isBlank()) {
                            maxWords = Math.max(maxWords, registerEntity(a.getName().trim()));
                        }
                    }
                }
                if (warehouseCategoryRepository != null) {
                    for (var w : warehouseCategoryRepository.findAll()) {
                        if (w.getName() != null && !w.getName().isBlank()) {
                            maxWords = Math.max(maxWords, registerEntity(w.getName().trim()));
                        }
                    }
                }
                if (productCategoryRepository != null) {
                    for (var p : productCategoryRepository.findAll()) {
                        if (p.getName() != null && !p.getName().isBlank()) {
                            String trimmed = p.getName().trim();
                            knownProductNames.add(trimmed);
                            maxWords = Math.max(maxWords, registerEntity(trimmed));
                        }
                    }
                }
                if (supplierRepository != null) {
                    for (var s : supplierRepository.findAll()) {
                        if (s.getName() != null && !s.getName().isBlank()) {
                            maxWords = Math.max(maxWords, registerEntity(s.getName().trim()));
                        }
                    }
                }
                if (brandRepository != null) {
                    for (var br : brandRepository.findAll()) {
                        if (br.getName() != null && !br.getName().isBlank()) {
                            maxWords = Math.max(maxWords, registerEntity(br.getName().trim()));
                        }
                    }
                }

                maxEntityWords = maxWords;
                lastRefreshed = now;
                log.debug("Refreshed dynamic AI speech vocabulary: {} barns, {} products, {} total entries",
                        knownBarnNames.size(), knownProductNames.size(), plainToCanonical.size());
            } catch (Exception ex) {
                log.warn("Could not refresh dynamic AI vocabulary: {}", ex.getMessage());
            }
        }
    }

    private int registerEntity(String canonicalName) {
        String plain = VietnameseSpeechNormalizer.removeVietnameseDiacritics(canonicalName)
                .replaceAll("\\s+", " ")
                .trim();
        if (plain.length() < 3 || STOP_ENTITY_KEYS.contains(plain)) {
            return 1;
        }
        plainToCanonical.putIfAbsent(plain, canonicalName);
        return plain.split(" ").length;
    }

    private String alignDynamicEntities(String text) {
        if (plainToCanonical.isEmpty() || text == null || text.isBlank()) {
            return text;
        }
        String[] words = text.split("\\s+");
        List<String> output = new ArrayList<>(words.length);
        int maxW = Math.min(maxEntityWords, words.length);
        int i = 0;

        while (i < words.length) {
            boolean matched = false;
            int tryMax = Math.min(maxW, words.length - i);
            for (int len = tryMax; len >= 1; len--) {
                String leadPunct = "";
                String trailPunct = "";
                StringBuilder candidateBuilder = new StringBuilder();

                for (int k = 0; k < len; k++) {
                    String w = words[i + k];
                    if (k == 0) {
                        Matcher m = PUNCT_WRAP.matcher(w);
                        if (m.matches()) {
                            leadPunct = m.group(1);
                            w = m.group(2) + (len == 1 ? "" : m.group(3));
                            if (len == 1) {
                                trailPunct = m.group(3);
                            }
                        }
                    } else if (k == len - 1) {
                        Matcher m = PUNCT_WRAP.matcher(w);
                        if (m.matches()) {
                            w = m.group(1) + m.group(2);
                            trailPunct = m.group(3);
                        }
                    }
                    if (k > 0) candidateBuilder.append(' ');
                    candidateBuilder.append(w);
                }

                String plainCandidate = VietnameseSpeechNormalizer.removeVietnameseDiacritics(candidateBuilder.toString())
                        .replaceAll("\\s+", " ")
                        .trim();
                String canonical = plainToCanonical.get(plainCandidate);
                if (canonical != null) {
                    output.add(leadPunct + canonical + trailPunct);
                    i += len;
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                output.add(words[i]);
                i++;
            }
        }
        return String.join(" ", output);
    }
}
