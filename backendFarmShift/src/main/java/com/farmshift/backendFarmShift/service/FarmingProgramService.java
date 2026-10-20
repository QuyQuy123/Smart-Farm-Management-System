package com.farmshift.backendFarmShift.service;

import com.farmshift.backendFarmShift.dto.request.FarmingProgramRequest;
import com.farmshift.backendFarmShift.dto.response.FarmingProgramResponse;
import com.farmshift.backendFarmShift.dto.response.ProgramStepResponse;
import com.farmshift.backendFarmShift.entity.*;
import com.farmshift.backendFarmShift.exception.BadRequestException;
import com.farmshift.backendFarmShift.exception.ConflictException;
import com.farmshift.backendFarmShift.exception.ResourceNotFoundException;
import com.farmshift.backendFarmShift.repository.FarmingProgramRepository;
import com.farmshift.backendFarmShift.repository.FlockRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.util.*;

import static com.farmshift.backendFarmShift.service.CycleService.clean;

/** Chương trình nuôi theo giống: cám định mức, lịch vắc-xin, thuốc trộn, nhiệt độ, công việc theo ngày tuổi. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class FarmingProgramService {
    private static final Set<AdministrationMethod> VACCINE_METHODS = EnumSet.of(AdministrationMethod.EYE_NOSE, AdministrationMethod.MOUTH,
            AdministrationMethod.DRINKING_WATER, AdministrationMethod.INJECTION, AdministrationMethod.WING_WEB);
    private static final Set<AdministrationMethod> MEDICINE_METHODS = EnumSet.of(AdministrationMethod.MIX_FEED, AdministrationMethod.MIX_WATER);
    private static final Map<ProgramStepCategory, String> LABELS = Map.of(ProgramStepCategory.FEED, "Cám định mức",
            ProgramStepCategory.VACCINE, "Vắc-xin", ProgramStepCategory.MEDICINE, "Thuốc trộn",
            ProgramStepCategory.TEMPERATURE, "Nhiệt độ", ProgramStepCategory.WORK, "Công việc");

    private final FarmingProgramRepository repository;
    private final FlockRepository flockRepository;

    public List<FarmingProgramResponse> list() {
        return repository.findAllByOrderByNameAsc().stream().map(program -> response(program, activeFlocks(program), null)).toList();
    }

    public FarmingProgramResponse get(Long id) {
        FarmingProgram program = find(id);
        return response(program, activeFlocks(program), null);
    }

    @Transactional
    public FarmingProgramResponse create(FarmingProgramRequest request) {
        return save(new FarmingProgram(), request);
    }

    @Transactional
    public FarmingProgramResponse update(Long id, FarmingProgramRequest request) {
        return save(find(id), request);
    }

    @Transactional
    public void delete(Long id) {
        FarmingProgram program = find(id);
        if (flockRepository.existsByProgramId(id)) {
            throw new ConflictException("Chương trình " + program.getName() + " đã được dùng cho đàn nuôi nên không thể xóa.", "PROGRAM_IN_USE", null);
        }
        repository.delete(program);
    }

    FarmingProgram find(Long id) {
        return repository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy chương trình nuôi."));
    }

    private long activeFlocks(FarmingProgram program) {
        return flockRepository.countByProgramIdAndStatus(program.getId(), FlockStatus.ACTIVE);
    }

    private FarmingProgramResponse save(FarmingProgram program, FarmingProgramRequest request) {
        String name = FarmAreaService.normalizeName(request.name());
        String key = name.toLowerCase(Locale.ROOT);
        boolean duplicate = program.getId() == null ? repository.existsByNameKey(key) : repository.existsByNameKeyAndIdNot(key, program.getId());
        if (duplicate) throw duplicateName();
        validate(request);
        program.setName(name);
        program.setNameKey(key);
        program.setBreed(FarmAreaService.normalizeName(request.breed()));
        program.setDurationDays(request.durationDays());
        program.setTargetWeightMin(request.targetWeightMin());
        program.setTargetWeightMax(request.targetWeightMax());
        program.setDescription(clean(request.description()));
        program.getSteps().clear();
        for (FarmingProgramRequest.Step item : request.steps()) program.getSteps().add(step(program, item));
        try {
            FarmingProgram saved = repository.saveAndFlush(program);
            return response(saved, activeFlocks(saved), null);
        } catch (DataIntegrityViolationException exception) {
            throw duplicateName();
        }
    }

    /** Each category keeps only the columns it needs, so stale values never leak into another category. */
    private static FarmingProgramStep step(FarmingProgram program, FarmingProgramRequest.Step item) {
        FarmingProgramStep step = new FarmingProgramStep();
        step.setProgram(program);
        step.setCategory(item.category());
        step.setName(item.name().strip());
        step.setDayFrom(item.dayFrom());
        step.setDayTo(item.dayTo());
        step.setNote(clean(item.note()));
        switch (item.category()) {
            case FEED -> { step.setQuantity(item.quantity()); step.setUnit("g/con/ngày"); step.setMealsPerDay(item.mealsPerDay()); }
            case VACCINE, MEDICINE -> { step.setQuantity(item.quantity()); step.setUnit(clean(item.unit())); step.setMethod(item.method()); }
            case TEMPERATURE -> { step.setTempMin(item.tempMin()); step.setTempMax(item.tempMax()); }
            case WORK -> { }
        }
        return step;
    }

    private static void validate(FarmingProgramRequest request) {
        if (request.targetWeightMin() != null && request.targetWeightMax() != null
                && request.targetWeightMin().compareTo(request.targetWeightMax()) > 0) {
            throw new BadRequestException("Cân nặng mục tiêu tối thiểu phải nhỏ hơn hoặc bằng tối đa.", "PROGRAM_WEIGHT_RANGE");
        }
        Map<ProgramStepCategory, List<FarmingProgramRequest.Step>> byCategory = new EnumMap<>(ProgramStepCategory.class);
        for (FarmingProgramRequest.Step step : request.steps()) {
            String label = LABELS.get(step.category()) + " \"" + step.name().strip() + "\"";
            if (step.dayFrom() > step.dayTo()) {
                throw new BadRequestException(label + ": ngày tuổi bắt đầu phải nhỏ hơn hoặc bằng ngày tuổi kết thúc.", "PROGRAM_STEP_RANGE");
            }
            if (step.dayTo() > request.durationDays()) {
                throw new BadRequestException(label + ": ngày tuổi " + step.dayTo() + " vượt thời gian nuôi " + request.durationDays() + " ngày.",
                        "PROGRAM_STEP_OUT_OF_DURATION");
            }
            switch (step.category()) {
                case FEED -> {
                    if (step.quantity() == null || step.quantity().signum() <= 0 || step.mealsPerDay() == null) {
                        throw new BadRequestException(label + ": cần nhập định mức (g/con/ngày) lớn hơn 0 và số cữ ăn trong ngày.", "PROGRAM_FEED_INCOMPLETE");
                    }
                }
                case VACCINE -> {
                    if (step.method() == null || !VACCINE_METHODS.contains(step.method())) {
                        throw new BadRequestException(label + ": chọn cách dùng vắc-xin (nhỏ mắt mũi, nhỏ miệng, pha nước, tiêm, chủng màng cánh).",
                                "PROGRAM_METHOD_REQUIRED");
                    }
                }
                case MEDICINE -> {
                    if (step.method() == null || !MEDICINE_METHODS.contains(step.method())) {
                        throw new BadRequestException(label + ": chọn cách dùng thuốc (trộn cám hoặc pha nước uống).", "PROGRAM_METHOD_REQUIRED");
                    }
                    if (step.quantity() == null || step.quantity().signum() <= 0 || step.unit() == null || step.unit().isBlank()) {
                        throw new BadRequestException(label + ": cần nhập liều lượng và đơn vị (ví dụ 2 g/kg cám, 1 ml/lít nước).", "PROGRAM_MEDICINE_DOSE");
                    }
                }
                case TEMPERATURE -> {
                    if (step.tempMin() == null || step.tempMax() == null || step.tempMin().compareTo(step.tempMax()) >= 0) {
                        throw new BadRequestException(label + ": nhiệt độ thấp nhất phải nhỏ hơn nhiệt độ cao nhất.", "PROGRAM_TEMPERATURE_RANGE");
                    }
                }
                case WORK -> { }
            }
            byCategory.computeIfAbsent(step.category(), key -> new ArrayList<>()).add(step);
        }
        if (!byCategory.containsKey(ProgramStepCategory.FEED)) {
            throw new BadRequestException("Chương trình nuôi cần có định mức cám.", "PROGRAM_FEED_REQUIRED");
        }
        // One feed ration and one temperature band per day of age.
        checkNoOverlap(byCategory.get(ProgramStepCategory.FEED), "Cám định mức", "PROGRAM_FEED_OVERLAP");
        checkNoOverlap(byCategory.getOrDefault(ProgramStepCategory.TEMPERATURE, List.of()), "Nhiệt độ", "PROGRAM_TEMPERATURE_OVERLAP");
    }

    private static void checkNoOverlap(List<FarmingProgramRequest.Step> steps, String label, String code) {
        List<FarmingProgramRequest.Step> sorted = steps.stream().sorted(Comparator.comparing(FarmingProgramRequest.Step::dayFrom)).toList();
        for (int i = 1; i < sorted.size(); i++) {
            FarmingProgramRequest.Step previous = sorted.get(i - 1), current = sorted.get(i);
            if (current.dayFrom() <= previous.dayTo()) {
                throw new BadRequestException(label + ": ngày " + previous.dayFrom() + "–" + previous.dayTo() + " và ngày " + current.dayFrom() + "–"
                        + current.dayTo() + " bị chồng nhau. Mỗi ngày tuổi chỉ có một mức.", code);
            }
        }
    }

    private ConflictException duplicateName() {
        return new ConflictException("Tên chương trình nuôi đã tồn tại.", "PROGRAM_DUPLICATE", "name");
    }

    /** currentDay (ngày tuổi của đàn) marks each step DONE / IN_PROGRESS / UPCOMING; null for plain templates. */
    static FarmingProgramResponse response(FarmingProgram program, long activeFlockCount, Integer currentDay) {
        List<ProgramStepResponse> steps = program.getSteps().stream().map(step -> new ProgramStepResponse(step.getId(), step.getCategory(),
                step.getName(), step.getDayFrom(), step.getDayTo(), step.getQuantity(), step.getUnit(), step.getMealsPerDay(), step.getMethod(),
                step.getTempMin(), step.getTempMax(), step.getNote(),
                currentDay == null ? null : currentDay > step.getDayTo() ? "DONE" : currentDay >= step.getDayFrom() ? "IN_PROGRESS" : "UPCOMING"))
                .toList();
        return new FarmingProgramResponse(program.getId(), String.format(Locale.ROOT, "CT%04d", program.getId()), program.getName(),
                program.getBreed(), program.getDurationDays(), program.getTargetWeightMin(), program.getTargetWeightMax(),
                program.getDescription(), steps, activeFlockCount, currentDay);
    }

    static BigDecimal kg(BigDecimal grams, int heads) {
        return grams.multiply(BigDecimal.valueOf(heads)).divide(BigDecimal.valueOf(1000), 1, java.math.RoundingMode.HALF_UP);
    }
}
