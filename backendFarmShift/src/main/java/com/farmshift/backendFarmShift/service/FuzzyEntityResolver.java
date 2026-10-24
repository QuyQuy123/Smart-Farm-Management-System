package com.farmshift.backendFarmShift.service;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;

/**
 * Giai đoạn 2 (lớp rule-based): đối chiếu cách nói tắt / gần đúng của người dùng với thực thể thật trong Database
 * (chuồng, vật tư, nhà cung cấp, hóa đơn) bằng Token Overlap + Substring + Levenshtein.
 *
 * <p>Ví dụ: "nhà cung cấp CP" khớp "Công ty CP Chăn nuôi C.P. Việt Nam", "thuốc lasota" khớp "Vaccine Lasota",
 * "higro 1" khớp "Higro 01", "a 1" khớp "Nhà A1".</p>
 */
public final class FuzzyEntityResolver {

    /** Các từ chung chung không giúp phân biệt thực thể. */
    private static final Set<String> STOP_WORDS = Set.of(
            "cam", "thuoc", "vaccine", "vac", "xin", "nha", "chuong", "cung", "cap", "cong", "ty", "cty", "tnhh",
            "co", "phan", "dai", "ly", "khu", "kho", "hang", "don", "nhap", "viet", "nam", "chan", "nuoi",
            "thuc", "an", "va", "cua", "cho", "sp", "gia", "ban", "vat", "tu");

    public record Match<T>(T entity, double score) {
    }

    private FuzzyEntityResolver() {
    }

    /** Chữ thường, không dấu, ký tự không phải chữ/số thành khoảng trắng. */
    public static String key(String text) {
        return VietnameseSpeechNormalizer.removeVietnameseDiacritics(text).replaceAll("[^a-z0-9]+", " ").trim();
    }

    public static List<String> tokens(String text) {
        String k = key(text);
        List<String> raw = k.isEmpty() ? new ArrayList<>() : new ArrayList<>(List.of(k.split(" ")));
        // Ghép "a" + "1" → "a1", "c" + "p" → "cp" (Whisper hay tách rời, "C.P." thành "c p").
        Set<String> out = new LinkedHashSet<>(raw);
        for (int i = 0; i + 1 < raw.size(); i++) {
            String a = raw.get(i);
            String b = raw.get(i + 1);
            if (a.length() == 1 && Character.isLetter(a.charAt(0)) && b.length() <= 2) {
                out.add(a + b);
            }
        }
        return new ArrayList<>(out);
    }

    private static boolean isNumeric(String s) {
        return !s.isEmpty() && s.chars().allMatch(Character::isDigit);
    }

    private static String stripZeros(String s) {
        String r = s.replaceFirst("^0+(?=\\d)", "");
        return r;
    }

    /** Hai token coi như khớp: bằng nhau, cùng số (01 = 1) hoặc gần giống (lỗi chính tả STT). */
    public static boolean tokenEquals(String a, String b) {
        if (a.equals(b)) return true;
        if (isNumeric(a) && isNumeric(b)) return stripZeros(a).equals(stripZeros(b));
        int min = Math.min(a.length(), b.length());
        if (min >= 5 && !isNumeric(a) && !isNumeric(b)) {
            int allowed = min >= 8 ? 2 : 1;
            return levenshtein(a, b) <= allowed;
        }
        return false;
    }

    public static int levenshtein(String a, String b) {
        int[] prev = new int[b.length() + 1];
        int[] cur = new int[b.length() + 1];
        for (int j = 0; j <= b.length(); j++) prev[j] = j;
        for (int i = 1; i <= a.length(); i++) {
            cur[0] = i;
            for (int j = 1; j <= b.length(); j++) {
                int cost = a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1;
                cur[j] = Math.min(Math.min(cur[j - 1] + 1, prev[j] + 1), prev[j - 1] + cost);
            }
            int[] tmp = prev;
            prev = cur;
            cur = tmp;
        }
        return prev[b.length()];
    }

    private static List<String> distinctive(String name) {
        List<String> all = tokens(name);
        List<String> filtered = new ArrayList<>();
        for (String t : all) {
            if (!STOP_WORDS.contains(t)) filtered.add(t);
        }
        return filtered.isEmpty() ? all : filtered;
    }

    private static boolean containsToken(List<String> haystack, String needle) {
        for (String t : haystack) {
            if (tokenEquals(t, needle)) return true;
        }
        return false;
    }

    /** Điểm khớp (0..1) của một thực thể với cả câu lệnh: tỉ lệ token đặc trưng của thực thể xuất hiện trong câu. */
    public static double scoreInText(String text, String entityName) {
        List<String> textTokens = tokens(text);
        List<String> cand = distinctive(entityName);
        if (cand.isEmpty()) return 0;
        int matched = 0;
        boolean wordMatched = false;
        boolean hasWord = false;
        for (String c : cand) {
            boolean numeric = isNumeric(c);
            if (!numeric) hasWord = true;
            if (containsToken(textTokens, c)) {
                matched++;
                if (!numeric) wordMatched = true;
            }
        }
        if (hasWord && !wordMatched) return 0;
        double score = (double) matched / cand.size();
        // Thưởng nếu cả tên đầy đủ (đã chuẩn hóa) xuất hiện nguyên vẹn trong câu.
        String fullKey = key(entityName);
        if (!fullKey.isEmpty() && (" " + key(text) + " ").contains(" " + fullKey + " ")) {
            score = Math.min(1.0, score + 0.25);
        }
        return score;
    }

    /** Tìm thực thể được nhắc tới trong cả câu lệnh (câu dài có nhiều thành phần khác). */
    public static <T> Optional<Match<T>> findInText(String text, Collection<T> candidates, Function<T, String> nameFn, double threshold) {
        T best = null;
        double bestScore = 0;
        int bestLen = Integer.MAX_VALUE;
        for (T candidate : candidates) {
            String name = nameFn.apply(candidate);
            if (name == null || name.isBlank()) continue;
            double score = scoreInText(text, name);
            int len = key(name).length();
            if (score > bestScore + 1e-9 || (Math.abs(score - bestScore) < 1e-9 && score > 0 && len > bestLen)) {
                // Cùng điểm: ưu tiên tên dài hơn (cụ thể hơn, vd "Nhà A10" trước "Nhà A1").
                best = candidate;
                bestScore = score;
                bestLen = len;
            }
        }
        return best != null && bestScore >= threshold ? Optional.of(new Match<>(best, bestScore)) : Optional.empty();
    }

    public static <T> T findEntityInText(String text, Collection<T> candidates, Function<T, String> nameFn, double threshold) {
        return findInText(text, candidates, nameFn, threshold).map(Match::entity).orElse(null);
    }

    /** Tìm thực thể gần đúng nhất với một cụm từ ngắn (vd: "cp", "lasota", "nhà a 1"). */
    public static <T> Optional<Match<T>> findBestMatch(String phrase, Collection<T> candidates, Function<T, String> nameFn, double threshold) {
        if (phrase == null || phrase.isBlank()) return Optional.empty();
        List<String> q = new ArrayList<>();
        for (String t : tokens(phrase)) {
            if (!STOP_WORDS.contains(t)) q.add(t);
        }
        if (q.isEmpty()) q = tokens(phrase);
        T best = null;
        double bestScore = 0;
        for (T candidate : candidates) {
            String name = nameFn.apply(candidate);
            if (name == null || name.isBlank()) continue;
            List<String> candTokens = tokens(name);
            int matched = 0;
            for (String t : q) {
                if (containsToken(candTokens, t)) matched++;
            }
            double queryCoverage = (double) matched / q.size();
            double candCoverage = scoreInText(phrase, name);
            double score = Math.max(queryCoverage * 0.6 + candCoverage * 0.4, key(name).contains(key(phrase)) && !key(phrase).isEmpty() ? 0.9 : 0);
            if (matched == 0) score = 0;
            if (score > bestScore) {
                best = candidate;
                bestScore = score;
            }
        }
        return best != null && bestScore >= threshold ? Optional.of(new Match<>(best, bestScore)) : Optional.empty();
    }
}
