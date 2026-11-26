package com.farmshift.backendFarmShift.service;

import com.farmshift.backendFarmShift.entity.Barn;
import com.farmshift.backendFarmShift.exception.BadRequestException;

import java.util.*;

/**
 * Danh mục việc hằng ngày mặc định cho mỗi chuồng từ đầu đến cuối lứa nuôi.
 * Chuồng có {@code routineTasks == null} mặc định bật đủ cả 3 việc;
 * chủ trại có thể bật/tắt từng việc theo chuồng (lưu dạng danh sách mã ngăn cách bằng dấu phẩy, chuỗi rỗng = tắt hết).
 */
public final class BarnRoutineTaskCatalog {
    public record Preset(String code, String title) {}

    public static final List<Preset> PRESETS = List.of(
            new Preset("CHANGE_LITTER", "Thay trấu"),
            new Preset("CLEAN_FEEDERS", "Vệ sinh máng"),
            new Preset("WASH_BARN", "Xịt rửa chuồng")
    );

    private static final Map<String, String> TITLES_BY_CODE;

    static {
        Map<String, String> map = new LinkedHashMap<>();
        for (Preset p : PRESETS) {
            map.put(p.code(), p.title());
        }
        TITLES_BY_CODE = Collections.unmodifiableMap(map);
    }

    private BarnRoutineTaskCatalog() {}

    public static boolean isValid(String code) {
        return code != null && TITLES_BY_CODE.containsKey(code.strip());
    }

    public static String titleOf(String code) {
        if (code == null) return "";
        return TITLES_BY_CODE.getOrDefault(code.strip(), code.strip());
    }

    public static List<String> enabledCodes(Barn barn) {
        if (barn == null || barn.getRoutineTasks() == null) {
            return PRESETS.stream().map(Preset::code).toList();
        }
        String raw = barn.getRoutineTasks().strip();
        if (raw.isEmpty()) {
            return List.of();
        }
        Set<String> enabled = new HashSet<>();
        for (String part : raw.split(",")) {
            String code = part.strip();
            if (TITLES_BY_CODE.containsKey(code)) {
                enabled.add(code);
            }
        }
        return PRESETS.stream().map(Preset::code).filter(enabled::contains).toList();
    }

    public static String encode(Collection<String> codes) {
        if (codes == null || codes.isEmpty()) {
            return "";
        }
        Set<String> selected = new HashSet<>();
        for (String raw : codes) {
            if (raw == null || raw.isBlank()) continue;
            String code = raw.strip();
            if (!TITLES_BY_CODE.containsKey(code)) {
                throw new BadRequestException("Mã công việc mặc định không hợp lệ: " + code, "ROUTINE_TASK_INVALID");
            }
            selected.add(code);
        }
        if (selected.isEmpty()) {
            return "";
        }
        return PRESETS.stream()
                .map(Preset::code)
                .filter(selected::contains)
                .collect(java.util.stream.Collectors.joining(","));
    }
}
