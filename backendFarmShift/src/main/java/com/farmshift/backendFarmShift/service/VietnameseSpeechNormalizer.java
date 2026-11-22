package com.farmshift.backendFarmShift.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Giai đoạn 1 của pipeline AI: chuẩn hóa tiếng Việt đời thường / kết quả Whisper STT trước khi phân tích ý định.
 *
 * <ul>
 *   <li>Số đếm bằng chữ: "hai mươi lăm" → 25, "ba trăm hai mươi" → 320, "chục" → 10, "một trăm rưỡi" → 150</li>
 *   <li>Số thập phân nói: "1 phẩy 45" → 1.45, "một cân rưỡi" → 1.5 kg, "một cân hai" → 1.2 kg, "8 lạng" → 0.8 kg</li>
 *   <li>Khối lượng phân số: "bốn bao rưỡi" → 4.5 bao (hoặc 112.5 kg ở chế độ quy đổi cám), "nửa bao" → 0.5 bao</li>
 *   <li>Tiền tệ nói tắt: "500 nghìn", "500k" → 500000; "1 triệu rưỡi", "1tr5" → 1500000; "20 củ" → 20000000</li>
 *   <li>Đơn vị: cân / ký / kí / lô → kg; gam / gram → g</li>
 *   <li>Thực thể bị tách rời / đọc chữ cái: "nhà a một" → "Nhà A1", "chuồng bê hai" → "Chuồng B2", "khu xê một" → "Khu C1"</li>
 * </ul>
 */
public final class VietnameseSpeechNormalizer {

    /** Một bao cám = 25 kg. */
    public static final double KG_PER_BAG = 25.0;
    private static final BigDecimal BD_KG_PER_BAG = BigDecimal.valueOf(25);
    private static final BigDecimal BD_HALF = new BigDecimal("0.5");

    private static final Map<String, Integer> UNITS = Map.ofEntries(
            Map.entry("một", 1), Map.entry("hai", 2), Map.entry("ba", 3), Map.entry("bốn", 4),
            Map.entry("tư", 4), Map.entry("năm", 5), Map.entry("sáu", 6),
            Map.entry("bảy", 7), Map.entry("tám", 8), Map.entry("chín", 9));

    private static final Map<String, String> SPOKEN_DIGIT_WORDS = Map.ofEntries(
            Map.entry("không", "0"), Map.entry("linh", "0"), Map.entry("lẻ", "0"),
            Map.entry("một", "1"), Map.entry("mốt", "1"), Map.entry("hai", "2"),
            Map.entry("ba", "3"), Map.entry("bốn", "4"), Map.entry("tư", "4"),
            Map.entry("năm", "5"), Map.entry("lăm", "5"), Map.entry("sáu", "6"),
            Map.entry("bảy", "7"), Map.entry("tám", "8"), Map.entry("chín", "9"));

    private static final Pattern LEAD_TRAIL_PUNCT = Pattern.compile("^([\\p{Punct}]*)(.*?)([\\p{Punct}]*)$");

    /** Số (có thể thập phân) không dính liền chữ cái / chữ số / dấu trừ khác, tránh bắt nhầm "1" trong "A1" hay ăn mất dấu "-" trong "-5 bao". */
    private static final String NUM = "(?<![\\p{L}\\d.,-])(\\d+(?:[.,]\\d+)?)";
    private static final String REST_GUARD = "(?![\\d]|\\s*(?:bao|con|kg|ký|kí|cân|m2|m²|ngày|lần|%))";
    private static final String UNIT_WORD_GROUP = "một|hai|ba|bốn|tư|năm|sáu|bảy|tám|chín";

    private static final Pattern HALF_HUNDRED = Pattern.compile(
            "(?iu)(?<![\\p{L}\\d.,])(?:(\\d+|" + UNIT_WORD_GROUP + ")\\s+)?trăm\\s+rưỡi(?![\\p{L}\\d])");
    private static final Pattern CHUC_TENS = Pattern.compile(
            "(?iu)(?<![\\p{L}\\d.,])(?:(\\d+|" + UNIT_WORD_GROUP + ")\\s+)?chục(?![\\p{L}\\d])");
    private static final Pattern HALF_BAG = Pattern.compile("(?iu)(?<![\\p{L}\\d.,])nửa\\s+bao(?![\\p{L}\\d])");
    private static final Pattern HALF_WEIGHT = Pattern.compile("(?iu)(?<![\\p{L}\\d.,])nửa\\s+(?:kg|ký|kí|cân)(?![\\p{L}\\d])");

    private static final Pattern DECIMAL_WORD = Pattern.compile("(?iu)(?<![\\p{L}\\d.,])(\\d+)\\s*(?:phẩy|chấm|phảy)\\s*(\\d+)");
    private static final Pattern WEIGHT_HALF = Pattern.compile("(?iu)" + NUM + "\\s*(?:kg|ký|kí|cân)\\s+rưỡi");
    private static final Pattern WEIGHT_MINOR = Pattern.compile("(?iu)(?<![\\p{L}\\d.,])(\\d+)\\s*(?:ký|kí|cân)\\s+(\\d)(?![\\d\\p{L}])(?!\\s*(?:con|bao|kg|ký|kí|cân|lô|gam|gram|lạng|triệu|nghìn|ngàn|k))");
    private static final Pattern BAG_HALF = Pattern.compile("(?iu)" + NUM + "\\s*bao\\s+rưỡi");
    private static final Pattern LANG_UNIT = Pattern.compile("(?iu)" + NUM + "\\s*lạng(?![\\p{L}\\d])");
    private static final Pattern MILLION = Pattern.compile(
            "(?iu)" + NUM + "\\s*(?:triệu|trieu|tr|củ)(?![\\p{L}])(?:\\s*(rưỡi|\\d{1,3})" + REST_GUARD + ")?");
    private static final Pattern THOUSAND = Pattern.compile(
            "(?iu)" + NUM + "\\s*(?:nghìn|nghin|ngàn|ngan|k)(?![\\p{L}])(?:\\s*(rưỡi|\\d{1,3})" + REST_GUARD + ")?");
    private static final Pattern MILLION_UPPER_M = Pattern.compile(NUM + "\\s?M(?![\\p{L}\\d])");
    private static final Pattern KG_UNIT = Pattern.compile("(?iu)" + NUM + "\\s*(?:kg|kilogam|kilôgam|kilo|ki\\s+lô|kí\\s+lô|ký|kí|cân)(?![\\p{L}\\d])");
    private static final Pattern LO_UNIT = Pattern.compile("(?iu)" + NUM + "\\s*lô(?![\\p{L}\\d])(?!\\s*(?:hàng|nhập|cám|thuốc|vắc|mới|cũ))");
    private static final Pattern GRAM_UNIT = Pattern.compile("(?iu)" + NUM + "\\s*(?:gam|gram)(?![\\p{L}\\d])");
    private static final Pattern BAG = Pattern.compile("(?iu)" + NUM + "\\s*bao(?![\\p{L}\\d])");
    /** "n h 0 0 0 0 0 3" (từng chữ số tách rời) hoặc "NH000003" / "nh 3". */
    private static final Pattern INVOICE_SPLIT = Pattern.compile("(?iu)(?<![\\p{L}\\d])n\\s*h\\s*[-_]?\\s*(\\d(?:\\s\\d)+|\\d+)(?![\\p{L}\\d])");
    private static final Pattern INVOICE_NUMBER = Pattern.compile(
            "(?iu)(?<![\\p{L}\\d])(?:hóa\\s+đơn|hoá\\s+đơn|đơn\\s+nhập\\s+hàng|đơn\\s+nhập|đơn\\s+hàng|đơn)\\s+(?:số\\s+)?(\\d{1,6})(?![\\d\\p{L}])");
    private static final Pattern BARN_SPLIT = Pattern.compile("(?iu)(?<![\\p{L}\\d])(nhà|chuồng|khu)\\s+([a-d])\\s*[-_]?\\s*(\\d{1,2})(?![\\d\\p{L}])");
    private static final Pattern MONEY_NUMBER = Pattern.compile("(?<![\\p{L}\\d.,-])(\\d{4,12})(?![\\p{L}\\d])");

    private VietnameseSpeechNormalizer() {
    }

    /** Chữ thường, bỏ dấu tiếng Việt, đ → d. */
    public static String removeVietnameseDiacritics(String text) {
        if (text == null) return "";
        String nfd = Normalizer.normalize(text, Normalizer.Form.NFD);
        String plain = nfd.replaceAll("\\p{InCombiningDiacriticalMarks}+", "");
        return plain.replace('đ', 'd').replace('Đ', 'D').toLowerCase(Locale.ROOT);
    }

    /** Hàm chuẩn hóa lệnh đầy đủ (quy đổi bao cám -> 25 kg để handler xử lý đồng nhất). */
    public static String normalizeVietnameseCommand(String rawText) {
        return normalizeCore(rawText, true, false);
    }

    /** Hàm chuẩn hóa hiển thị / bản chép STT giữ nguyên đơn vị "bao" ("bốn bao rưỡi" -> "4.5 bao") và viết hoa Nhà/Chuồng/Khu. */
    public static String normalizeSpokenTranscript(String rawText) {
        return normalizeCore(rawText, false, true);
    }

    private static String normalizeCore(String rawText, boolean convertBagsToKg, boolean capitalizeEntities) {
        if (rawText == null) return "";
        String text = Normalizer.normalize(rawText, Normalizer.Form.NFC).replace('\u00A0', ' ').trim().replaceAll("\\s+", " ");
        if (text.isEmpty()) return text;

        text = fixSttHomophones(text);

        // Spoken half-hundreds & tens ("một trăm rưỡi" -> 150, "chết chục con" -> "chết 10 con", "hai chục con" -> "20 con")
        text = replaceAll(HALF_HUNDRED, text, m -> {
            BigDecimal base = m.group(1) != null ? parseWordOrDecimal(m.group(1)) : BigDecimal.ONE;
            return formatBigDecimal(base.multiply(BigDecimal.valueOf(100)).add(BigDecimal.valueOf(50)));
        });
        text = replaceAll(CHUC_TENS, text, m -> {
            BigDecimal base = m.group(1) != null ? parseWordOrDecimal(m.group(1)) : BigDecimal.ONE;
            return formatBigDecimal(base.multiply(BigDecimal.TEN));
        });

        text = wordNumbersToDigits(text);
        text = DECIMAL_WORD.matcher(text).replaceAll("$1.$2");
        text = HALF_BAG.matcher(text).replaceAll("0.5 bao");
        text = HALF_WEIGHT.matcher(text).replaceAll("0.5 kg");
        text = replaceAll(WEIGHT_HALF, text, m -> formatBigDecimal(parseBigDecimal(m.group(1)).add(BD_HALF)) + " kg");
        text = replaceAll(WEIGHT_MINOR, text, m -> m.group(1) + "." + m.group(2) + " kg");
        text = replaceAll(BAG_HALF, text, m -> formatBigDecimal(parseBigDecimal(m.group(1)).add(BD_HALF)) + " bao");
        text = replaceAll(LANG_UNIT, text, m -> formatBigDecimal(parseBigDecimal(m.group(1)).divide(BigDecimal.TEN, 4, RoundingMode.HALF_UP)) + " kg");

        text = replaceAll(MILLION, text, m -> String.valueOf(millions(m.group(1), m.group(2))));
        text = replaceAll(MILLION_UPPER_M, text, m -> String.valueOf(Math.round(parseDecimal(m.group(1)) * 1_000_000)));
        text = replaceAll(THOUSAND, text, m -> String.valueOf(thousands(m.group(1), m.group(2))));

        text = replaceAll(KG_UNIT, text, m -> m.group(1).replace(',', '.') + " kg");
        text = replaceAll(LO_UNIT, text, m -> m.group(1).replace(',', '.') + " kg");
        text = replaceAll(GRAM_UNIT, text, m -> m.group(1).replace(',', '.') + " g");

        if (convertBagsToKg) {
            String plain = removeVietnameseDiacritics(text);
            if (plain.contains("cam") || plain.contains("thuc an") || plain.contains("cho an")) {
                text = replaceAll(BAG, text, m -> formatBigDecimal(parseBigDecimal(m.group(1)).multiply(BD_KG_PER_BAG)) + " kg");
            } else if (!plain.contains("vac xin") && !plain.contains("thuoc") && !plain.contains("trau")
                    && !plain.contains("dung") && !plain.contains("gia cam") && !plain.contains("hoa don")) {
                // "hai bao" -> "50 kg" (STT thường rớt chữ "cám"); bỏ qua khi câu nói về vật tư khác.
                text = replaceAll(BAG, text, m -> formatBigDecimal(parseBigDecimal(m.group(1)).multiply(BD_KG_PER_BAG)) + " kg");
            }
        }

        text = replaceAll(INVOICE_SPLIT, text, m -> invoiceCode(m.group(1).replaceAll("\\s+", "")));
        text = replaceAll(INVOICE_NUMBER, text, m -> invoiceCode(m.group(1)));
        text = replaceAll(BARN_SPLIT, text, m -> {
            String prefix = capitalizeEntities ? capitalizeWord(m.group(1)) : m.group(1);
            return prefix + " " + m.group(2).toUpperCase(Locale.ROOT) + m.group(3);
        });
        return text.replaceAll("\\s+", " ").trim();
    }

    /** Số tiền lớn nhất (>= 1.000) trong câu đã chuẩn hóa, bỏ qua mã phiếu như NH000003. */
    public static Long extractMoney(String normalizedText) {
        if (normalizedText == null) return null;
        Matcher m = MONEY_NUMBER.matcher(normalizedText);
        Long best = null;
        while (m.find()) {
            long value = Long.parseLong(m.group(1));
            if (best == null || value > best) best = value;
        }
        return best;
    }

    /** Lấy số (kể cả thập phân) đứng ngay trước đơn vị kg trong câu đã chuẩn hóa. */
    public static Double extractKg(String normalizedText) {
        if (normalizedText == null) return null;
        Matcher m = Pattern.compile("(?iu)(\\d+(?:\\.\\d+)?)\\s*kg").matcher(normalizedText);
        return m.find() ? Double.parseDouble(m.group(1)) : null;
    }

    public static String invoiceCode(String digits) {
        return String.format(Locale.ROOT, "NH%06d", Long.parseLong(digits));
    }

    // ───────────────────────────── đồng âm / nhận nhầm của STT ─────────────────────────────

    private static final String DIGIT_WORD_TOKEN = "(?:không|linh|lẻ|một|mốt|hai|ba|bốn|tư|năm|lăm|sáu|bảy|tám|chín)";

    private static final Pattern HIGRO_SPOKEN_DIGITS = Pattern.compile(
            "(?iu)(?<![\\p{L}])(?:hai|hi|hy|hai\\s+gờ|hi\\s+gờ|hi\\s+gơ|hai\\s+grô|hi\\s+grô)\\s*(?:rô|grô|gờ\\s*rô|gơ\\s*rô|gro)\\s+("
                    + DIGIT_WORD_TOKEN + "(?:\\s+" + DIGIT_WORD_TOKEN + "){1,2})(?![\\p{L}\\d])");

    private static final Pattern[] HOMOPHONE_PATTERNS = {
            Pattern.compile("(?iu)(?<![\\p{L}])nhật\\s+(?:kí|kỉ|kỹ|ky|kì|kỷ)(?![\\p{L}])"),
            Pattern.compile("(?iu)(?<![\\p{L}\\d])(?:hóa|hoá)\\s+đơn"),
            Pattern.compile("(?iu)(?<![\\p{L}\\d.,])((?:\\d+(?:[.,]\\d+)?|một|hai|ba|bốn|năm|sáu|bảy|tám|chín|mười)\\s+)?triệu\\s+rưỡi(?![\\p{L}])"),
            Pattern.compile("(?iu)(?<![\\p{L}])(?:(?:hai|hi|hy|hai\\s+gờ|hi\\s+gờ|hi\\s+gơ|hai\\s+grô|hi\\s+grô)\\s*(?:rô|grô|gờ\\s*rô|gơ\\s*rô|gro)|higro)\\s*(0?[12]|\\d{2,4})?(?![\\p{L}\\d])"),
            Pattern.compile("(?iu)(?<![\\p{L}])(?:đa\\s+ba\\s+cô|da\\s+ba\\s+co|đabacô)(?![\\p{L}])"),
            Pattern.compile("(?iu)(?<![\\p{L}])(?:han\\s+vét|hàn\\s+vét)(?![\\p{L}])"),
            Pattern.compile("(?iu)(?<![\\p{L}])(?:la\\s+sô\\s+ta|la\\s+xô\\s+ta|lasôta|lát\\s+sô\\s+ta)(?![\\p{L}])"),
            Pattern.compile("(?iu)(?<![\\p{L}])(?:gum\\s+bô\\s+rô|găm\\s+bô\\s+rô)(?![\\p{L}])"),
            Pattern.compile("(?iu)(?<![\\p{L}])cám\\s+số\\s+([12])(?![\\p{L}\\d])"),
            Pattern.compile("(?iu)(?<![\\p{L}])(?:xi\\s+pi|si\\s+pi)\\s*(511|512)(?![\\p{L}\\d])"),
            Pattern.compile("(?iu)(?<![\\p{L}])(?:ca\\s+giu|ca\\s+gin|các\\s+giu)(?![\\p{L}])"),
            Pattern.compile("(?iu)(?<![\\p{L}])(?:niu\\s+cát\\s+xơn|nhiu\\s+cát\\s+xơn|niu\\s+cat\\s+xon|niu\\s+cát\\s+xơ)(?![\\p{L}])"),
            Pattern.compile("(?iu)(?<![\\p{L}])(?:ép\\s+xê\\s+rờ|ép\\s+cờ\\s+rờ|f\\s+c\\s+r|hệ\\s+số\\s+ép)(?![\\p{L}])"),
            Pattern.compile("(?iu)(?<![\\p{L}])(?:cần\\s+mẫu|cân\\s+mẩu)(?![\\p{L}])"),
            Pattern.compile("(?iu)(?<![\\p{L}])hao\\s+hục(?![\\p{L}])"),
            Pattern.compile("(?iu)(?<![\\p{L}])thải\\s+lọai(?![\\p{L}])"),
            Pattern.compile("(?iu)(?<![\\p{L}])khu\\s+(?:di|gi|j)\\s+thịt(?![\\p{L}])"),
            Pattern.compile("(?iu)(?<![\\p{L}])khu\\s+mía(?:\\s+thịt)?(?![\\p{L}])"),
            Pattern.compile("(?iu)(?<![\\p{L}])(nhà|chuồng|khu)\\s+(?:bê|be)(?=\\s+(?:\\d|một|hai|ba|bốn|năm|sáu|bảy|tám|chín))"),
            Pattern.compile("(?iu)(?<![\\p{L}])(nhà|chuồng|khu)\\s+(?:xê|xe|cê|ce)(?=\\s+(?:\\d|một|hai|ba|bốn|năm|sáu|bảy|tám|chín))"),
            Pattern.compile("(?iu)(?<![\\p{L}])(nhà|chuồng|khu)\\s+(?:đê|de|dê)(?=\\s+(?:\\d|một|hai|ba|bốn|năm|sáu|bảy|tám|chín))"),
    };

    /** Sửa các cụm đồng âm tiếng Việt hay bị Whisper / Web Speech nhận nhầm. */
    static String fixSttHomophones(String text) {
        String out = replaceAll(HIGRO_SPOKEN_DIGITS, text, m -> "Higro " + joinSpokenDigits(m.group(1)));
        out = HOMOPHONE_PATTERNS[0].matcher(out).replaceAll("nhật ký");
        out = HOMOPHONE_PATTERNS[1].matcher(out).replaceAll("hóa đơn");
        out = HOMOPHONE_PATTERNS[2].matcher(out).replaceAll(r -> r.group(1) != null ? r.group(0) : "1 triệu rưỡi");
        out = HOMOPHONE_PATTERNS[3].matcher(out).replaceAll(r -> {
            String num = r.group(1);
            if (num == null || num.isEmpty()) return "Higro";
            if ("1".equals(num)) num = "01";
            else if ("2".equals(num)) num = "02";
            return "Higro " + num;
        });
        out = HOMOPHONE_PATTERNS[4].matcher(out).replaceAll("Dabaco");
        out = HOMOPHONE_PATTERNS[5].matcher(out).replaceAll("Hanvet");
        out = HOMOPHONE_PATTERNS[6].matcher(out).replaceAll("Lasota");
        out = HOMOPHONE_PATTERNS[7].matcher(out).replaceAll("Gumboro");
        out = HOMOPHONE_PATTERNS[8].matcher(out).replaceAll("Higro 0$1");
        out = HOMOPHONE_PATTERNS[9].matcher(out).replaceAll("CP $1");
        out = HOMOPHONE_PATTERNS[10].matcher(out).replaceAll("Cargill");
        out = HOMOPHONE_PATTERNS[11].matcher(out).replaceAll("Newcastle");
        out = HOMOPHONE_PATTERNS[12].matcher(out).replaceAll("FCR");
        out = HOMOPHONE_PATTERNS[13].matcher(out).replaceAll("cân mẫu");
        out = HOMOPHONE_PATTERNS[14].matcher(out).replaceAll("hao hụt");
        out = HOMOPHONE_PATTERNS[15].matcher(out).replaceAll("thải loại");
        out = HOMOPHONE_PATTERNS[16].matcher(out).replaceAll("Khu J Thịt");
        out = HOMOPHONE_PATTERNS[17].matcher(out).replaceAll("Khu Mía Thịt");
        out = HOMOPHONE_PATTERNS[18].matcher(out).replaceAll("$1 B");
        out = HOMOPHONE_PATTERNS[19].matcher(out).replaceAll("$1 C");
        out = HOMOPHONE_PATTERNS[20].matcher(out).replaceAll("$1 D");
        return out;
    }

    private static String joinSpokenDigits(String seq) {
        StringBuilder sb = new StringBuilder();
        for (String tok : seq.trim().toLowerCase(Locale.ROOT).split("\\s+")) {
            sb.append(SPOKEN_DIGIT_WORDS.getOrDefault(tok, tok));
        }
        return sb.toString();
    }

    // ───────────────────────────── số đếm bằng chữ ─────────────────────────────

    private static String wordNumbersToDigits(String text) {
        String[] tokens = text.split(" ");
        List<String> out = new ArrayList<>();
        int i = 0;
        while (i < tokens.length) {
            String[] parts = splitPunct(tokens[i]);
            int[] parsed = parseNumber(tokens, i);
            if (parsed == null) {
                out.add(tokens[i]);
                i++;
                continue;
            }
            int last = i + parsed[1] - 1;
            String[] lastParts = splitPunct(tokens[last]);
            out.add(parts[0] + parsed[0] + lastParts[2]);
            i += parsed[1];
        }
        return String.join(" ", out);
    }

    /** @return {giá trị, số token đã tiêu thụ} hoặc null. */
    private static int[] parseNumber(String[] tokens, int i) {
        String t = key(tokens, i);
        if (t == null) return null;
        if ("trăm".equals(t) && isMagnitude(key(tokens, i + 1))) return new int[]{100, 1};
        if (UNITS.containsKey(t) && "trăm".equals(key(tokens, i + 1))) {
            int total = UNITS.get(t) * 100;
            int pos = i + 2;
            String next = key(tokens, pos);
            if (("linh".equals(next) || "lẻ".equals(next)) && key(tokens, pos + 1) != null && UNITS.containsKey(key(tokens, pos + 1))) {
                total += UNITS.get(key(tokens, pos + 1));
                pos += 2;
            } else {
                int[] tens = parseTens(tokens, pos);
                if (tens != null) {
                    total += tens[0];
                    pos += tens[1];
                }
            }
            return new int[]{total, pos - i};
        }
        return parseTens(tokens, i);
    }

    private static int[] parseTens(String[] tokens, int i) {
        String t = key(tokens, i);
        if (t == null) return null;
        String next = key(tokens, i + 1);
        if ("mười".equals(t)) {
            if ("lăm".equals(next)) return new int[]{15, 2};
            if (next != null && UNITS.containsKey(next)) return new int[]{10 + UNITS.get(next), 2};
            return new int[]{10, 1};
        }
        if (!UNITS.containsKey(t)) return null;
        int u = UNITS.get(t);
        if ("mươi".equals(next)) {
            int v = u * 10;
            String third = key(tokens, i + 2);
            if ("mốt".equals(third)) return new int[]{v + 1, 3};
            if ("tư".equals(third)) return new int[]{v + 4, 3};
            if ("lăm".equals(third)) return new int[]{v + 5, 3};
            if (third != null && UNITS.containsKey(third)) return new int[]{v + UNITS.get(third), 3};
            return new int[]{v, 2};
        }
        if ("lăm".equals(next) && u >= 2) return new int[]{u * 10 + 5, 2};
        return new int[]{u, 1};
    }

    private static boolean isMagnitude(String t) {
        return "nghìn".equals(t) || "ngàn".equals(t) || "triệu".equals(t);
    }

    private static String key(String[] tokens, int i) {
        if (i >= tokens.length) return null;
        return splitPunct(tokens[i])[1].toLowerCase(Locale.ROOT);
    }

    private static String[] splitPunct(String token) {
        Matcher m = LEAD_TRAIL_PUNCT.matcher(token);
        return m.matches() ? new String[]{m.group(1), m.group(2), m.group(3)} : new String[]{"", token, ""};
    }

    // ───────────────────────────── tiền tệ / số ─────────────────────────────

    /** "1 triệu rưỡi" = 1.500.000; "1 triệu 2" = 1.200.000; "1 triệu 200" = 1.200.000; "1,5 triệu" = 1.500.000. */
    private static long millions(String main, String rest) {
        long value = Math.round(parseDecimal(main) * 1_000_000);
        if (rest == null) return value;
        if (rest.equalsIgnoreCase("rưỡi")) return value + 500_000;
        int r = Integer.parseInt(rest);
        return value + (r < 10 ? r * 100_000L : r * 1_000L);
    }

    /** "500 nghìn" = 500.000; "2 nghìn rưỡi" = 2.500; "1 nghìn 2" = 1.200. */
    private static long thousands(String main, String rest) {
        long value = Math.round(parseDecimal(main) * 1_000);
        if (rest == null) return value;
        if (rest.equalsIgnoreCase("rưỡi")) return value + 500;
        int r = Integer.parseInt(rest);
        return value + (r < 10 ? r * 100L : r);
    }

    private static BigDecimal parseWordOrDecimal(String token) {
        String lower = token.trim().toLowerCase(Locale.ROOT);
        if (UNITS.containsKey(lower)) {
            return BigDecimal.valueOf(UNITS.get(lower));
        }
        return parseBigDecimal(token);
    }

    private static BigDecimal parseBigDecimal(String s) {
        return new BigDecimal(s.replace(',', '.'));
    }

    private static double parseDecimal(String s) {
        return parseBigDecimal(s).doubleValue();
    }

    static String formatBigDecimal(BigDecimal bd) {
        BigDecimal stripped = bd.stripTrailingZeros();
        if (stripped.scale() < 0) {
            stripped = stripped.setScale(0, RoundingMode.HALF_UP);
        }
        return stripped.toPlainString();
    }

    static String formatNumber(double value) {
        if (value == Math.floor(value) && !Double.isInfinite(value)) return String.valueOf((long) value);
        return BigDecimal.valueOf(value).stripTrailingZeros().toPlainString();
    }

    private static String capitalizeWord(String w) {
        if (w == null || w.isEmpty()) return w;
        return Character.toUpperCase(w.charAt(0)) + w.substring(1).toLowerCase(Locale.ROOT);
    }

    private interface Replacer {
        String apply(Matcher m);
    }

    private static String replaceAll(Pattern pattern, String text, Replacer replacer) {
        Matcher m = pattern.matcher(text);
        StringBuilder sb = new StringBuilder();
        while (m.find()) {
            m.appendReplacement(sb, Matcher.quoteReplacement(replacer.apply(m)));
        }
        m.appendTail(sb);
        return sb.toString();
    }
}
