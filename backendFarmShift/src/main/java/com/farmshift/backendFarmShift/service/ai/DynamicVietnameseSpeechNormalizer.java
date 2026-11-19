package com.farmshift.backendFarmShift.service.ai;

import com.farmshift.backendFarmShift.repository.BarnRepository;
import com.farmshift.backendFarmShift.repository.BrandRepository;
import com.farmshift.backendFarmShift.repository.FarmAreaRepository;
import com.farmshift.backendFarmShift.repository.ProductCategoryRepository;
import com.farmshift.backendFarmShift.repository.SupplierRepository;
import com.farmshift.backendFarmShift.repository.WarehouseCategoryRepository;
import com.farmshift.backendFarmShift.service.FuzzyEntityResolver;
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
 * backed by a 60-second TTL cache, accent-folded Levenshtein fuzzy DB alignment (>= 0.78),
 * and explicit cache eviction hooks.
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
    private VoiceContextPromptBuilder voiceContextPromptBuilder;

    private volatile long lastRefreshed = 0L;
    private static final long CACHE_TTL_MILLIS = 60_000L; // 60 seconds
    private static final double FUZZY_SIMILARITY_THRESHOLD = 0.78;
    private static final Pattern PUNCT_WRAP = Pattern.compile("^([\\p{Punct}]*)(.*?)([\\p{Punct}]*)$");
    private static final Pattern DIGIT_SEQ_PATTERN = Pattern.compile("\\d+");
    private static final Pattern ALNUM_CODE_PATTERN = Pattern.compile("\\b[a-z]{1,4}\\d+\\b");

    private static final Set<String> STOP_ENTITY_KEYS = Set.of(
            "cam", "thuoc", "nha", "chuong", "kho", "khu", "ga", "bao", "con", "kg", "vac xin"
    );

    private static final Set<String> PROTECTED_PHRASES = Set.of(
            "cho an", "can mau", "hao hut", "nhap kho", "xuat ban", "hoa don", "cong no",
            "nha cung cap", "thuc an", "nhat ky", "bao cao", "viec hom nay"
    );

    private static final Set<String> GRAMMAR_BOUNDARY_WORDS = Set.of(
            "cho", "an", "va", "cua", "tu", "den", "la", "duoc", "thanh", "het", "chet",
            "bao", "kg", "g", "con", "lo", "lieu", "sang", "o", "tai", "voi"
    );

    private final Set<String> knownBarnNames = ConcurrentHashMap.newKeySet();
    private final Set<String> knownProductNames = ConcurrentHashMap.newKeySet();
    private final Map<String, String> plainToCanonical = new ConcurrentHashMap<>();
    private volatile List<LexiconEntry> lexiconEntries = List.of();
    private volatile int maxEntityWords = 1;

    public record NormalizationResult(String normalizedText, List<Map<String, String>> corrections) {
    }

    private record LexiconEntry(String canonical, String plain, String compactPlain, int wordCount, List<String> digitSignature) {
    }

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

    @Autowired(required = false)
    public void setVoiceContextPromptBuilder(VoiceContextPromptBuilder voiceContextPromptBuilder) {
        this.voiceContextPromptBuilder = voiceContextPromptBuilder;
    }

    public String normalize(String rawMessage) {
        return normalizeWithCorrections(rawMessage).normalizedText();
    }

    public NormalizationResult normalizeWithCorrections(String rawMessage) {
        if (rawMessage == null || rawMessage.isBlank()) {
            return new NormalizationResult("", List.of());
        }

        List<Map<String, String>> corrections = new ArrayList<>();

        // 1. Base Vietnamese normalization (spoken numbers, decimals, counts, barn codes, units)
        String normalized = VietnameseSpeechNormalizer.normalizeSpokenTranscript(rawMessage);

        // 2. Refresh dynamic vocabulary if TTL (60s) expired or cache evicted
        refreshIfNeeded();

        // 3. Dynamic exact + Levenshtein fuzzy entity alignment against live DB catalog
        String aligned = alignEntities(normalized, plainToCanonical, lexiconEntries, maxEntityWords, corrections);
        return new NormalizationResult(aligned, corrections);
    }

    /**
     * RBAC-scoped variant for ROLE_FARM_WORKER: aligns ONLY against the caller's pre-filtered entity dictionary,
     * never touching the global cache of unassigned barns, warehouses, or suppliers.
     */
    public NormalizationResult normalizeWithCorrectionsScoped(
            String rawMessage,
            Map<String, List<String>> scopedEntities
    ) {
        if (rawMessage == null || rawMessage.isBlank()) {
            return new NormalizationResult("", List.of());
        }

        String normalized = VietnameseSpeechNormalizer.normalizeSpokenTranscript(rawMessage);
        if (scopedEntities == null || scopedEntities.isEmpty()) {
            return new NormalizationResult(normalized, List.of());
        }

        Map<String, String> scopedExact = new HashMap<>();
        List<LexiconEntry> scopedEntries = new ArrayList<>();
        int scopedMaxWords = 1;

        for (List<String> values : scopedEntities.values()) {
            if (values == null) continue;
            for (String item : values) {
                if (item != null && !item.isBlank()) {
                    scopedMaxWords = Math.max(scopedMaxWords, registerEntity(item.trim(), scopedExact, scopedEntries));
                }
            }
        }

        if (scopedExact.isEmpty()) {
            return new NormalizationResult(normalized, List.of());
        }

        scopedEntries.sort(Comparator.comparingInt(LexiconEntry::wordCount).reversed()
                .thenComparing(Comparator.comparingInt((LexiconEntry e) -> e.plain().length()).reversed()));

        List<Map<String, String>> corrections = new ArrayList<>();
        String aligned = alignEntities(normalized, scopedExact, scopedEntries, scopedMaxWords, corrections);
        return new NormalizationResult(aligned, corrections);
    }

    /** Explicitly clears cached entity lexicons across both normalizer and Whisper context prompt builder. */
    public synchronized void evictLexiconCache() {
        lastRefreshed = 0L;
        knownBarnNames.clear();
        knownProductNames.clear();
        plainToCanonical.clear();
        lexiconEntries = List.of();
        maxEntityWords = 1;
        if (voiceContextPromptBuilder != null) {
            voiceContextPromptBuilder.evictLexiconCache();
        }
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
                List<LexiconEntry> rebuiltEntries = new ArrayList<>();
                int maxWords = 1;

                if (barnRepository != null) {
                    for (var b : barnRepository.findAll()) {
                        if (b.getName() != null && !b.getName().isBlank()) {
                            String trimmed = b.getName().trim();
                            knownBarnNames.add(trimmed);
                            maxWords = Math.max(maxWords, registerEntity(trimmed, rebuiltEntries));
                        }
                    }
                }
                if (areaRepository != null) {
                    for (var a : areaRepository.findAll()) {
                        if (a.getName() != null && !a.getName().isBlank()) {
                            maxWords = Math.max(maxWords, registerEntity(a.getName().trim(), rebuiltEntries));
                        }
                    }
                }
                if (warehouseCategoryRepository != null) {
                    for (var w : warehouseCategoryRepository.findAll()) {
                        if (w.getName() != null && !w.getName().isBlank()) {
                            maxWords = Math.max(maxWords, registerEntity(w.getName().trim(), rebuiltEntries));
                        }
                    }
                }
                if (productCategoryRepository != null) {
                    for (var p : productCategoryRepository.findAll()) {
                        if (p.getName() != null && !p.getName().isBlank()) {
                            String trimmed = p.getName().trim();
                            knownProductNames.add(trimmed);
                            maxWords = Math.max(maxWords, registerEntity(trimmed, rebuiltEntries));
                        }
                    }
                }
                if (supplierRepository != null) {
                    for (var s : supplierRepository.findAll()) {
                        if (s.getName() != null && !s.getName().isBlank()) {
                            maxWords = Math.max(maxWords, registerEntity(s.getName().trim(), rebuiltEntries));
                        }
                    }
                }
                if (brandRepository != null) {
                    for (var br : brandRepository.findAll()) {
                        if (br.getName() != null && !br.getName().isBlank()) {
                            maxWords = Math.max(maxWords, registerEntity(br.getName().trim(), rebuiltEntries));
                        }
                    }
                }

                rebuiltEntries.sort(Comparator.comparingInt(LexiconEntry::wordCount).reversed()
                        .thenComparing(Comparator.comparingInt((LexiconEntry e) -> e.plain().length()).reversed()));
                lexiconEntries = List.copyOf(rebuiltEntries);
                maxEntityWords = maxWords;
                lastRefreshed = now;
                log.debug("Refreshed dynamic AI speech vocabulary: {} barns, {} products, {} total entries",
                        knownBarnNames.size(), knownProductNames.size(), plainToCanonical.size());
            } catch (Exception ex) {
                log.warn("Could not refresh dynamic AI vocabulary: {}", ex.getMessage());
            }
        }
    }

    private int registerEntity(String canonicalName, List<LexiconEntry> entries) {
        return registerEntity(canonicalName, plainToCanonical, entries);
    }

    private int registerEntity(
            String canonicalName,
            Map<String, String> exactMap,
            List<LexiconEntry> entries
    ) {
        String plain = normalizeEntityKey(canonicalName);
        if (plain.length() < 3 || STOP_ENTITY_KEYS.contains(plain)) {
            return 1;
        }
        String existing = exactMap.putIfAbsent(plain, canonicalName);
        if (existing == null) {
            int wc = plain.split(" ").length;
            entries.add(new LexiconEntry(canonicalName, plain, plain.replace(" ", ""), wc, extractDigitSignature(plain)));
            return wc;
        }
        return plain.split(" ").length;
    }

    private String alignEntities(
            String text,
            Map<String, String> exactMap,
            List<LexiconEntry> entries,
            int maxWords,
            List<Map<String, String>> corrections
    ) {
        if (exactMap.isEmpty() || text == null || text.isBlank()) {
            return text;
        }
        String[] words = text.split("\\s+");
        List<String> output = new ArrayList<>(words.length);
        int maxW = Math.min(maxWords + 1, words.length);
        int i = 0;

        while (i < words.length) {
            boolean matched = false;
            int tryMax = Math.min(maxW, words.length - i);
            for (int len = tryMax; len >= 1; len--) {
                SpanWindow window = extractSpanWindow(words, i, len);
                String plainCandidate = normalizeEntityKey(window.rawInner());
                if (plainCandidate.isEmpty() || STOP_ENTITY_KEYS.contains(plainCandidate) || PROTECTED_PHRASES.contains(plainCandidate)) {
                    continue;
                }

                // 1. Exact accent-folded DB lookup
                String exactCanonical = exactMap.get(plainCandidate);
                if (exactCanonical != null) {
                    if (!window.rawInner().equals(exactCanonical)) {
                        recordCorrection(corrections, window.rawInner(), exactCanonical);
                    }
                    output.add(window.leadPunct() + exactCanonical + window.trailPunct());
                    i += len;
                    matched = true;
                    break;
                }

                // 2. Fuzzy Levenshtein DB alignment (>= 0.78) with strict digit-sequence lock
                String fuzzyCanonical = findBestFuzzyEntity(words, i, len, plainCandidate, entries);
                if (fuzzyCanonical != null) {
                    recordCorrection(corrections, window.rawInner(), fuzzyCanonical);
                    output.add(window.leadPunct() + fuzzyCanonical + window.trailPunct());
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

    private String findBestFuzzyEntity(
            String[] words,
            int startIdx,
            int spanLen,
            String plainCandidate,
            List<LexiconEntry> entries
    ) {
        if (plainCandidate.length() < 5) {
            return null;
        }
        String firstPlain = normalizeEntityKey(words[startIdx]);
        String lastPlain = normalizeEntityKey(words[startIdx + spanLen - 1]);
        List<String> candDigits = extractDigitSignature(plainCandidate);
        List<String> candCodes = extractCodeTokens(plainCandidate);
        String compactCandidate = plainCandidate.replace(" ", "");

        String bestCanonical = null;
        double bestScore = 0.0;
        int bestLen = 0;

        for (LexiconEntry entry : entries) {
            if (entry.plain().length() < 5) {
                continue;
            }
            if (spanLen != entry.wordCount()) {
                if (entry.wordCount() == 1 || Math.abs(spanLen - entry.wordCount()) > 1) {
                    continue;
                }
                if (GRAMMAR_BOUNDARY_WORDS.contains(firstPlain) || GRAMMAR_BOUNDARY_WORDS.contains(lastPlain)) {
                    continue;
                }
            }
            if ((!candDigits.isEmpty() || !entry.digitSignature().isEmpty())
                    && !candDigits.equals(entry.digitSignature())) {
                continue;
            }
            List<String> entryCodes = extractCodeTokens(entry.plain());
            if ((!candCodes.isEmpty() || !entryCodes.isEmpty()) && !candCodes.equals(entryCodes)) {
                continue;
            }

            double simSpaced = similarity(plainCandidate, entry.plain());
            double simCompact = similarity(compactCandidate, entry.compactPlain());
            double score = Math.max(simSpaced, simCompact);
            if (score >= FUZZY_SIMILARITY_THRESHOLD) {
                if (score > bestScore + 1e-6 || (Math.abs(score - bestScore) <= 1e-6 && entry.plain().length() > bestLen)) {
                    bestScore = score;
                    bestLen = entry.plain().length();
                    bestCanonical = entry.canonical();
                }
            }
        }
        return bestCanonical;
    }

    private record SpanWindow(String leadPunct, String rawInner, String trailPunct) {
    }

    private static SpanWindow extractSpanWindow(String[] words, int start, int len) {
        String leadPunct = "";
        String trailPunct = "";
        StringBuilder sb = new StringBuilder();
        for (int k = 0; k < len; k++) {
            String w = words[start + k];
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
            if (k > 0) sb.append(' ');
            sb.append(w);
        }
        return new SpanWindow(leadPunct, sb.toString(), trailPunct);
    }

    private static String normalizeEntityKey(String raw) {
        return VietnameseSpeechNormalizer.removeVietnameseDiacritics(raw)
                .replaceAll("\\s+", " ")
                .trim();
    }

    private static List<String> extractDigitSignature(String plain) {
        List<String> sig = new ArrayList<>();
        Matcher m = DIGIT_SEQ_PATTERN.matcher(plain);
        while (m.find()) {
            String trimmed = m.group().replaceFirst("^0+(?=\\d)", "");
            sig.add(trimmed);
        }
        return sig;
    }

    private static List<String> extractCodeTokens(String plain) {
        if (plain == null || plain.isBlank()) {
            return List.of();
        }
        List<String> codes = new ArrayList<>();
        Matcher m = ALNUM_CODE_PATTERN.matcher(plain.toLowerCase(Locale.ROOT));
        while (m.find()) {
            codes.add(m.group());
        }
        return codes;
    }

    private static double similarity(String a, String b) {
        int maxLen = Math.max(a.length(), b.length());
        if (maxLen == 0) return 0.0;
        int dist = FuzzyEntityResolver.levenshtein(a, b);
        return 1.0 - ((double) dist / maxLen);
    }

    private static void recordCorrection(List<Map<String, String>> corrections, String from, String to) {
        if (from == null || to == null || from.isBlank() || to.isBlank() || from.equals(to)) {
            return;
        }
        Map<String, String> entry = Map.of("from", from.trim(), "to", to.trim());
        if (!corrections.contains(entry)) {
            corrections.add(entry);
        }
    }
}
