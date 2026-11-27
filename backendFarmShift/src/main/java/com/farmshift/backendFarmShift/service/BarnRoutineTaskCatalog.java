package com.farmshift.backendFarmShift.service;

import com.farmshift.backendFarmShift.entity.Barn;
import com.farmshift.backendFarmShift.exception.BadRequestException;

import java.text.Normalizer;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Danh mục việc hằng ngày mặc định cho mỗi chuồng từ đầu đến cuối lứa nuôi.
 * Chuồng có {@code routineTasks == null} mặc định bật 3 việc cơ bản (Thay trấu, Vệ sinh máng, Xịt rửa chuồng);
 * chủ trại có thể chọn nhanh trong 12 việc mẫu hoặc thêm việc tự định nghĩa (tiền tố {@code CUSTOM:}) theo từng chuồng.
 */
public final class BarnRoutineTaskCatalog {
    public record Preset(String code, String title) {}

    public static final String CUSTOM_PREFIX = "CUSTOM:";
    public static final int MAX_CUSTOM_TITLE_LENGTH = 50;
    public static final int MAX_TASKS_PER_BARN = 25;

    public static final List<Preset> PRESETS = List.of(
            new Preset("CHANGE_LITTER", "Thay trấu"),
            new Preset("CLEAN_FEEDERS", "Vệ sinh máng"),
            new Preset("WASH_BARN", "Xịt rửa chuồng"),
            new Preset("FEED_AND_WATER", "Cho ăn & uống"),
            new Preset("LOG_MORTALITY", "Ghi chép hao hụt"),
            new Preset("GIVE_SUPPLEMENTS", "Cho uống thuốc bổ"),
            new Preset("CHECK_TEMPERATURE", "Kiểm tra nhiệt độ"),
            new Preset("COLLECT_MORTALITY", "Thu gom xác chết"),
            new Preset("CHECK_EXHAUST_FANS", "Kiểm tra quạt hút"),
            new Preset("DISINFECT_WALKWAY", "Sát trùng lối đi"),
            new Preset("SAMPLE_WEIGHING", "Cân mẫu gà"),
            new Preset("CHECK_BROODER", "Kiểm tra quầy úm")
    );

    public static final List<String> DEFAULT_CODES = List.of("CHANGE_LITTER", "CLEAN_FEEDERS", "WASH_BARN");

    private static final Map<String, String> TITLES_BY_CODE;
    private static final Map<String, String> PRESET_CODE_BY_TITLE_KEY;

    static {
        Map<String, String> titles = new LinkedHashMap<>();
        Map<String, String> byTitle = new LinkedHashMap<>();
        for (Preset p : PRESETS) {
            titles.put(p.code(), p.title());
            byTitle.put(normalizeKey(p.title()), p.code());
        }
        TITLES_BY_CODE = Collections.unmodifiableMap(titles);
        PRESET_CODE_BY_TITLE_KEY = Collections.unmodifiableMap(byTitle);
    }

    private BarnRoutineTaskCatalog() {}

    public static boolean isValid(String code) {
        if (code == null) return false;
        String trimmed = code.strip();
        if (TITLES_BY_CODE.containsKey(trimmed)) {
            return true;
        }
        if (trimmed.startsWith(CUSTOM_PREFIX)) {
            String title = cleanCustomTitle(trimmed.substring(CUSTOM_PREFIX.length()));
            return !title.isEmpty()
                    && title.length() <= MAX_CUSTOM_TITLE_LENGTH
                    && !containsForbiddenChars(title);
        }
        return false;
    }

    public static String titleOf(String code) {
        if (code == null) return "";
        String trimmed = code.strip();
        if (TITLES_BY_CODE.containsKey(trimmed)) {
            return TITLES_BY_CODE.get(trimmed);
        }
        if (trimmed.startsWith(CUSTOM_PREFIX)) {
            return cleanCustomTitle(trimmed.substring(CUSTOM_PREFIX.length()));
        }
        return trimmed;
    }

    public static List<String> enabledCodes(Barn barn) {
        if (barn == null || barn.getRoutineTasks() == null) {
            return DEFAULT_CODES;
        }
        String raw = barn.getRoutineTasks().strip();
        if (raw.isEmpty()) {
            return List.of();
        }
        Set<String> enabledPresets = new HashSet<>();
        Map<String, String> customByKey = new LinkedHashMap<>();
        for (String part : raw.split(",")) {
            String token = part.strip();
            if (token.isEmpty()) continue;
            if (TITLES_BY_CODE.containsKey(token)) {
                enabledPresets.add(token);
            } else if (token.startsWith(CUSTOM_PREFIX)) {
                String title = cleanCustomTitle(token.substring(CUSTOM_PREFIX.length()));
                if (!title.isEmpty() && title.length() <= MAX_CUSTOM_TITLE_LENGTH && !containsForbiddenChars(title)) {
                    String key = normalizeKey(title);
                    String matchingPreset = PRESET_CODE_BY_TITLE_KEY.get(key);
                    if (matchingPreset != null) {
                        enabledPresets.add(matchingPreset);
                    } else {
                        customByKey.putIfAbsent(key, CUSTOM_PREFIX + title);
                    }
                }
            }
        }
        List<String> result = new ArrayList<>();
        for (Preset p : PRESETS) {
            if (enabledPresets.contains(p.code())) {
                result.add(p.code());
            }
        }
        result.addAll(customByKey.values());
        return result;
    }

    public static String encode(Collection<String> codes) {
        if (codes == null || codes.isEmpty()) {
            return "";
        }
        Set<String> selectedPresets = new HashSet<>();
        Map<String, String> customByKey = new LinkedHashMap<>();
        for (String raw : codes) {
            if (raw == null || raw.isBlank()) continue;
            String token = raw.strip();
            if (TITLES_BY_CODE.containsKey(token)) {
                selectedPresets.add(token);
            } else if (token.startsWith(CUSTOM_PREFIX)) {
                String title = cleanCustomTitle(token.substring(CUSTOM_PREFIX.length()));
                if (title.isEmpty() || containsForbiddenChars(title)) {
                    throw new BadRequestException("Tên công việc tự định nghĩa không hợp lệ (không chứa dấu phẩy hoặc xuống dòng).", "ROUTINE_TASK_INVALID");
                }
                if (title.length() > MAX_CUSTOM_TITLE_LENGTH) {
                    throw new BadRequestException("Tên công việc tự định nghĩa tối đa " + MAX_CUSTOM_TITLE_LENGTH + " ký tự.", "ROUTINE_TASK_INVALID");
                }
                String key = normalizeKey(title);
                String matchingPreset = PRESET_CODE_BY_TITLE_KEY.get(key);
                if (matchingPreset != null) {
                    selectedPresets.add(matchingPreset);
                } else {
                    customByKey.putIfAbsent(key, CUSTOM_PREFIX + title);
                }
            } else {
                throw new BadRequestException("Mã công việc mặc định không hợp lệ: " + token, "ROUTINE_TASK_INVALID");
            }
        }

        List<String> ordered = new ArrayList<>();
        for (Preset p : PRESETS) {
            if (selectedPresets.contains(p.code())) {
                ordered.add(p.code());
            }
        }
        ordered.addAll(customByKey.values());

        if (ordered.size() > MAX_TASKS_PER_BARN) {
            throw new BadRequestException("Mỗi chuồng chỉ chọn tối đa " + MAX_TASKS_PER_BARN + " công việc hằng ngày.", "ROUTINE_TASKS_LIMIT_EXCEEDED");
        }
        return ordered.stream().collect(Collectors.joining(","));
    }

    private static String cleanCustomTitle(String raw) {
        if (raw == null) return "";
        return Normalizer.normalize(raw, Normalizer.Form.NFC)
                .replaceAll("[\\s]+", " ")
                .strip();
    }

    private static boolean containsForbiddenChars(String title) {
        return title.indexOf(',') >= 0 || title.indexOf('\r') >= 0 || title.indexOf('\n') >= 0;
    }

    private static String normalizeKey(String text) {
        return cleanCustomTitle(text).toLowerCase(Locale.ROOT);
    }
}
