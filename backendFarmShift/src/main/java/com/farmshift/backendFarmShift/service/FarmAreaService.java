package com.farmshift.backendFarmShift.service;

import com.farmshift.backendFarmShift.dto.request.FarmAreaRequest;
import com.farmshift.backendFarmShift.dto.response.FarmAreaResponse;
import com.farmshift.backendFarmShift.entity.BarnStatus;
import com.farmshift.backendFarmShift.entity.FarmArea;
import com.farmshift.backendFarmShift.exception.BadRequestException;
import com.farmshift.backendFarmShift.exception.ConflictException;
import com.farmshift.backendFarmShift.exception.ResourceNotFoundException;
import com.farmshift.backendFarmShift.repository.BarnRepository;
import com.farmshift.backendFarmShift.repository.FarmAreaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.text.Normalizer;
import java.util.*;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class FarmAreaService {
    /** Chỉ số môi trường có thể theo dõi, theo thứ tự hiển thị. */
    public static final List<String> ENVIRONMENT_METRICS = List.of("HUMIDITY", "TEMPERATURE");
    /** Chỉ số vật nuôi có thể theo dõi, theo thứ tự hiển thị. */
    public static final List<String> ANIMAL_METRICS = List.of("WEIGHT", "LOSS", "MANURE", "ANIMAL_PHOTO", "DEAD_PHOTO", "NOTE");

    private final FarmAreaRepository repository;
    private final BarnRepository barnRepository;

    public List<FarmAreaResponse> list() {
        Map<Long, long[]> summaries = summaries();
        return repository.findAll(Sort.by(Sort.Direction.ASC, "createdAt", "id")).stream()
                .map(area -> response(area, summaries.get(area.getId()))).toList();
    }

    public FarmAreaResponse get(Long id) {
        return response(find(id), summaries().get(id));
    }

    @Transactional
    public FarmAreaResponse create(FarmAreaRequest request) {
        return save(new FarmArea(), request);
    }

    @Transactional
    public FarmAreaResponse update(Long id, FarmAreaRequest request) {
        return save(find(id), request);
    }

    @Transactional
    public void delete(Long id) {
        FarmArea area = find(id);
        long barns = barnRepository.countByAreaId(id);
        if (barns > 0) {
            throw new ConflictException("Khu nuôi đang có " + barns + " chuồng. Hãy xóa hoặc chuyển các chuồng sang khu khác trước khi xóa khu nuôi.",
                    "FARM_AREA_HAS_BARNS", null);
        }
        repository.delete(area);
    }

    FarmArea find(Long id) {
        return repository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy khu nuôi."));
    }

    static String normalizeName(String name) {
        return Normalizer.normalize(name.strip().replaceAll("\\s+", " "), Normalizer.Form.NFC);
    }

    private FarmAreaResponse save(FarmArea area, FarmAreaRequest request) {
        String name = normalizeName(request.name());
        String key = name.toLowerCase(Locale.ROOT);
        boolean duplicate = area.getId() == null ? repository.existsByNameKey(key)
                : repository.existsByNameKeyAndIdNot(key, area.getId());
        if (duplicate) throw duplicateName();
        area.setName(name);
        area.setNameKey(key);
        area.setEnvironmentMetrics(String.join(",", metrics(request.environmentMetrics(), ENVIRONMENT_METRICS, "môi trường")));
        area.setAnimalMetrics(String.join(",", metrics(request.animalMetrics(), ANIMAL_METRICS, "vật nuôi")));
        area.setDescription(request.description() == null ? "" : request.description().strip());
        try {
            FarmArea saved = repository.saveAndFlush(area);
            return response(saved, summaries().get(saved.getId()));
        } catch (DataIntegrityViolationException exception) {
            throw duplicateName();
        }
    }

    /** Validates the selected metric codes and returns them de-duplicated in display order. */
    private List<String> metrics(List<String> selected, List<String> allowed, String label) {
        if (selected == null) return List.of();
        Set<String> codes = new HashSet<>();
        for (String code : selected) {
            if (code == null || !allowed.contains(code)) {
                throw new BadRequestException("Chỉ số theo dõi " + label + " không hợp lệ: " + code + ".", "FARM_AREA_INVALID_METRIC");
            }
            codes.add(code);
        }
        return allowed.stream().filter(codes::contains).toList();
    }

    private Map<Long, long[]> summaries() {
        Map<Long, long[]> result = new HashMap<>();
        for (Object[] row : barnRepository.summarizeByArea(BarnStatus.ACTIVE)) {
            result.put((Long) row[0], new long[]{toLong(row[1]), toLong(row[2]), toLong(row[3]), toLong(row[4])});
        }
        return result;
    }

    private static long toLong(Object value) {
        return value == null ? 0 : ((Number) value).longValue();
    }

    private static List<String> split(String value) {
        return value == null || value.isBlank() ? List.of() : List.of(value.split(","));
    }

    private ConflictException duplicateName() {
        return new ConflictException("Tên khu nuôi đã tồn tại.", "FARM_AREA_DUPLICATE", "name");
    }

    private FarmAreaResponse response(FarmArea area, long[] summary) {
        long[] counts = summary == null ? new long[4] : summary;
        return new FarmAreaResponse(area.getId(), String.format(Locale.ROOT, "KN%06d", area.getId()), area.getName(),
                split(area.getEnvironmentMetrics()), split(area.getAnimalMetrics()),
                area.getDescription(), counts[0], counts[1], counts[2], counts[3], area.getCreatedAt(), area.getUpdatedAt());
    }
}
