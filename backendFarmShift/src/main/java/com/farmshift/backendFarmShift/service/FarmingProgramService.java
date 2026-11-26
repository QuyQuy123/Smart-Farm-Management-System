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
import com.farmshift.backendFarmShift.repository.InventoryItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;

import static com.farmshift.backendFarmShift.service.CycleService.clean;

/** Chương trình nuôi theo giống: cám định mức, lịch uống thuốc, lịch vắc-xin & thủ thuật, thuốc trộn theo ngày tuổi. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class FarmingProgramService {
    public static final String FEED_MODE_GRAM = "GRAM_PER_BIRD_DAY";
    public static final String FEED_MODE_BAGS = "BAGS_PER_1000_BIRDS";
    public static final BigDecimal DEFAULT_BAG_WEIGHT_KG = new BigDecimal("25.000");
    /** Giới hạn cột NUMERIC(14,3) trên farming_program_steps (quantity, bags_per_1000_birds). */
    public static final BigDecimal MAX_STEP_QUANTITY = new BigDecimal("99999999999.999");
    /** Giới hạn cột NUMERIC(10,3) trên farming_program_steps (bag_weight_kg). */
    public static final BigDecimal MAX_BAG_WEIGHT_KG = new BigDecimal("9999999.999");

    public static final Set<AdministrationMethod> VACCINE_METHODS = EnumSet.of(AdministrationMethod.EYE_NOSE, AdministrationMethod.MOUTH,
            AdministrationMethod.DRINKING_WATER, AdministrationMethod.INJECTION, AdministrationMethod.WING_WEB);
    public static final Set<AdministrationMethod> MEDICINE_METHODS = EnumSet.of(AdministrationMethod.MIX_FEED, AdministrationMethod.MIX_WATER);
    public static final Set<AdministrationMethod> DRINKING_MEDICINE_METHODS = EnumSet.of(
            AdministrationMethod.HAND_DRINKER, AdministrationMethod.AUTO_DRINKER,
            AdministrationMethod.MIX_WATER, AdministrationMethod.DRINKING_WATER);
    public static final Set<AdministrationMethod> CARE_PROCEDURE_METHODS = EnumSet.of(AdministrationMethod.PROCEDURE);
    private static final Map<ProgramStepCategory, String> LABELS = Map.of(
            ProgramStepCategory.FEED, "Cám định mức",
            ProgramStepCategory.VACCINE, "Vắc-xin",
            ProgramStepCategory.MEDICINE, "Thuốc trộn",
            ProgramStepCategory.DRINKING_MEDICINE, "Lịch uống thuốc",
            ProgramStepCategory.CARE_PROCEDURE, "Thủ thuật chăm sóc",
            ProgramStepCategory.TEMPERATURE, "Nhiệt độ",
            ProgramStepCategory.WORK, "Công việc");

    /** Quy đổi định mức cám từ bao / 1.000 con / giai đoạn sang g/con/ngày. */
    public static BigDecimal toGramPerBirdPerDay(BigDecimal bagsPer1000Birds, BigDecimal bagWeightKg, int dayFrom, int dayTo) {
        int days = Math.max(1, dayTo - dayFrom + 1);
        BigDecimal weight = bagWeightKg != null && bagWeightKg.signum() > 0 ? bagWeightKg : DEFAULT_BAG_WEIGHT_KG;
        return bagsPer1000Birds.multiply(weight)
                .multiply(BigDecimal.valueOf(1000))
                .divide(BigDecimal.valueOf(1000L * days), 3, RoundingMode.HALF_UP);
    }

    private final FarmingProgramRepository repository;
    private final FlockRepository flockRepository;
    private final InventoryItemRepository inventoryRepository;

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
    private FarmingProgramStep step(FarmingProgram program, FarmingProgramRequest.Step item) {
        FarmingProgramStep step = new FarmingProgramStep();
        step.setProgram(program);
        step.setCategory(item.category());
        step.setName(item.name().strip());
        step.setDayFrom(item.dayFrom());
        step.setDayTo(item.dayTo());
        step.setNote(clean(item.note()));
        switch (item.category()) {
            case FEED -> {
                if (FEED_MODE_BAGS.equalsIgnoreCase(item.feedInputMode())) {
                    BigDecimal bagWeight = item.bagWeightKg() != null ? item.bagWeightKg().setScale(3, RoundingMode.HALF_UP) : DEFAULT_BAG_WEIGHT_KG;
                    BigDecimal bags = item.bagsPer1000Birds().setScale(3, RoundingMode.HALF_UP);
                    step.setQuantity(toGramPerBirdPerDay(bags, bagWeight, item.dayFrom(), item.dayTo()));
                    step.setFeedInputMode(FEED_MODE_BAGS);
                    step.setBagWeightKg(bagWeight);
                    step.setBagsPer1000Birds(bags);
                } else {
                    step.setQuantity(item.quantity() == null ? null : item.quantity().setScale(3, RoundingMode.HALF_UP));
                    step.setFeedInputMode(FEED_MODE_GRAM);
                }
                step.setUnit("g/con/ngày");
                step.setMealsPerDay(item.mealsPerDay());
            }
            case VACCINE, MEDICINE, DRINKING_MEDICINE -> {
                step.setQuantity(item.quantity() == null ? null : item.quantity().setScale(3, RoundingMode.HALF_UP));
                step.setUnit(clean(item.unit()));
                step.setMethod(item.method());
            }
            case CARE_PROCEDURE -> {
                step.setMethod(item.method() != null ? item.method() : AdministrationMethod.PROCEDURE);
                step.setQuantity(item.quantity() == null ? null : item.quantity().setScale(3, RoundingMode.HALF_UP));
                step.setUnit(clean(item.unit()));
            }
            case TEMPERATURE -> { step.setTempMin(item.tempMin()); step.setTempMax(item.tempMax()); }
            case WORK -> { }
        }
        step.setInventoryItem(inventoryItem(step, item.inventoryItemId()));
        return step;
    }

    /**
     * Cám, thuốc, vắc-xin có thể gắn một hàng hóa trong kho. Hàng hóa phải có quy cách (ví dụ Bao 25kg = 25 kg)
     * cùng loại đại lượng với định mức để quy đổi được: cám theo khối lượng, thuốc / vắc-xin theo tử số của đơn vị liều.
     */
    private InventoryItem inventoryItem(FarmingProgramStep step, Long itemId) {
        if (itemId == null) return null;
        String label = LABELS.get(step.getCategory()) + " \"" + step.getName() + "\"";
        if (step.getCategory() == ProgramStepCategory.TEMPERATURE
                || step.getCategory() == ProgramStepCategory.WORK
                || step.getCategory() == ProgramStepCategory.CARE_PROCEDURE) {
            throw new BadRequestException(label + ": chỉ cám, thuốc và vắc-xin mới gắn hàng hóa kho.", "PROGRAM_ITEM_NOT_ALLOWED");
        }
        InventoryItem item = inventoryRepository.findById(itemId).orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy hàng hóa trong kho."));
        String itemName = item.getProduct().getName();
        if (!UsageMath.hasContent(item)) {
            throw new BadRequestException(label + ": hàng hóa " + itemName + " chưa có quy cách đơn vị (ví dụ Bao 25kg = 25 kg). "
                    + "Hãy khai báo quy cách ở Thiết lập danh mục → Đơn vị tính.", "PROGRAM_ITEM_NO_CONTENT");
        }
        UsageUnit usage = UsageMath.usageUnit(step.getCategory(), step.getUnit());
        if (usage == null) {
            throw new BadRequestException(label + ": đơn vị liều chưa rõ. Dùng dạng g/..., ml/..., gói/... hoặc liều/con để trừ kho được.", "PROGRAM_ITEM_DOSE_UNIT");
        }
        if (!UsageMath.compatible(item, usage)) {
            throw new BadRequestException(label + ": định mức tính theo " + usage.label() + " nhưng hàng hóa " + itemName + " đóng theo "
                    + item.getUnit().getContentUnit().label() + ", không quy đổi được.", "PROGRAM_ITEM_UNIT_MISMATCH");
        }
        if ((step.getCategory() == ProgramStepCategory.MEDICINE || step.getCategory() == ProgramStepCategory.DRINKING_MEDICINE)
                && UsageMath.basis(step.getCategory(), step.getUnit()) == null) {
            throw new BadRequestException(label + ": đơn vị liều cần ghi rõ tính theo kg cám, lít nước, con hoặc 1000 con (ví dụ 2 g/kg cám, 0,5 gói/1000 con).", "PROGRAM_ITEM_DOSE_UNIT");
        }
        if (step.getCategory() == ProgramStepCategory.VACCINE && (step.getQuantity() == null || step.getQuantity().signum() <= 0)) {
            throw new BadRequestException(label + ": cần nhập liều cho mỗi con để tính số lọ vắc-xin.", "PROGRAM_ITEM_DOSE_UNIT");
        }
        return item;
    }

    static void validate(FarmingProgramRequest request) {
        if (request.targetWeightMin() != null
                && (request.targetWeightMin().compareTo(new BigDecimal("0.01")) < 0 || request.targetWeightMin().compareTo(new BigDecimal("20")) > 0)) {
            throw new BadRequestException("Cân nặng mục tiêu phải từ 0,01 đến 20 kg.", "PROGRAM_WEIGHT_RANGE");
        }
        if (request.targetWeightMax() != null
                && (request.targetWeightMax().compareTo(new BigDecimal("0.01")) < 0 || request.targetWeightMax().compareTo(new BigDecimal("20")) > 0)) {
            throw new BadRequestException("Cân nặng mục tiêu phải từ 0,01 đến 20 kg.", "PROGRAM_WEIGHT_RANGE");
        }
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
            if (step.quantity() != null && step.quantity().setScale(3, RoundingMode.HALF_UP).compareTo(MAX_STEP_QUANTITY) > 0) {
                throw new BadRequestException(label + ": định mức vượt giới hạn tối đa cho phép.", "PROGRAM_QUANTITY_OVERFLOW");
            }
            if (step.unit() != null && step.unit().strip().length() > 50) {
                throw new BadRequestException(label + ": đơn vị không quá 50 ký tự.", "PROGRAM_UNIT_TOO_LONG");
            }
            switch (step.category()) {
                case FEED -> {
                    boolean bagsMode = FEED_MODE_BAGS.equalsIgnoreCase(step.feedInputMode());
                    if (step.feedInputMode() != null && !step.feedInputMode().isBlank()
                            && !FEED_MODE_GRAM.equalsIgnoreCase(step.feedInputMode()) && !bagsMode) {
                        throw new BadRequestException(label + ": chế độ nhập cám chỉ hỗ trợ GRAM_PER_BIRD_DAY hoặc BAGS_PER_1000_BIRDS.", "PROGRAM_FEED_INCOMPLETE");
                    }
                    if (bagsMode) {
                        if (step.bagsPer1000Birds() == null || step.bagsPer1000Birds().signum() <= 0 || step.mealsPerDay() == null) {
                            throw new BadRequestException(label + ": cần nhập định mức (bao/1.000 con) lớn hơn 0 và số cữ ăn trong ngày.", "PROGRAM_FEED_INCOMPLETE");
                        }
                        if (step.bagsPer1000Birds().setScale(3, RoundingMode.HALF_UP).compareTo(MAX_STEP_QUANTITY) > 0) {
                            throw new BadRequestException(label + ": định mức bao/1.000 con vượt giới hạn tối đa cho phép.", "PROGRAM_QUANTITY_OVERFLOW");
                        }
                        if (step.bagWeightKg() != null && step.bagWeightKg().signum() <= 0) {
                            throw new BadRequestException(label + ": khối lượng 1 bao cám phải lớn hơn 0.", "PROGRAM_FEED_INCOMPLETE");
                        }
                        if (step.bagWeightKg() != null && step.bagWeightKg().setScale(3, RoundingMode.HALF_UP).compareTo(MAX_BAG_WEIGHT_KG) > 0) {
                            throw new BadRequestException(label + ": khối lượng 1 bao cám vượt giới hạn tối đa cho phép.", "PROGRAM_QUANTITY_OVERFLOW");
                        }
                        BigDecimal converted = toGramPerBirdPerDay(step.bagsPer1000Birds(), step.bagWeightKg(), step.dayFrom(), step.dayTo());
                        if (converted.signum() <= 0) {
                            throw new BadRequestException(label + ": định mức sau quy đổi phải lớn hơn 0 g/con/ngày.", "PROGRAM_FEED_INCOMPLETE");
                        }
                        if (converted.compareTo(MAX_STEP_QUANTITY) > 0) {
                            throw new BadRequestException(label + ": định mức sau quy đổi vượt giới hạn tối đa cho phép.", "PROGRAM_QUANTITY_OVERFLOW");
                        }
                    } else if (step.quantity() == null || step.quantity().signum() <= 0 || step.mealsPerDay() == null) {
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
                case DRINKING_MEDICINE -> {
                    if (step.method() == null || !DRINKING_MEDICINE_METHODS.contains(step.method())) {
                        throw new BadRequestException(label + ": chọn phương thức uống thuốc (bình xách tay hoặc hệ thống uống tự động).", "PROGRAM_METHOD_REQUIRED");
                    }
                    if (step.quantity() == null || step.quantity().signum() <= 0 || step.unit() == null || step.unit().isBlank()) {
                        throw new BadRequestException(label + ": cần nhập liều lượng và đơn vị (ví dụ 0,5 gói/1000 con, 1 g/lít nước).", "PROGRAM_MEDICINE_DOSE");
                    }
                }
                case CARE_PROCEDURE -> {
                    if (step.method() != null && !CARE_PROCEDURE_METHODS.contains(step.method())) {
                        throw new BadRequestException(label + ": phương thức thủ thuật chăm sóc không hợp lệ.", "PROGRAM_METHOD_REQUIRED");
                    }
                }
                case TEMPERATURE -> {
                    if (step.tempMin() == null || step.tempMax() == null || step.tempMin().compareTo(step.tempMax()) >= 0
                            || step.tempMin().compareTo(new BigDecimal("10")) < 0 || step.tempMax().compareTo(new BigDecimal("45")) > 0) {
                        throw new BadRequestException(label + ": nhiệt độ phải từ 10 đến 45°C và thấp nhất nhỏ hơn cao nhất.", "PROGRAM_TEMPERATURE_RANGE");
                    }
                }
                case WORK -> throw new BadRequestException("Chương trình nuôi chỉ gồm cám, lịch uống thuốc, vắc-xin, thủ thuật và thuốc trộn. "
                        + "Công việc chăm sóc được giao riêng, không khai báo trong chương trình.", "PROGRAM_WORK_NOT_ALLOWED");
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
                currentDay == null ? null : currentDay > step.getDayTo() ? "DONE" : currentDay >= step.getDayFrom() ? "IN_PROGRESS" : "UPCOMING",
                step.getInventoryItem() == null ? null : step.getInventoryItem().getId(),
                step.getInventoryItem() == null ? null : step.getInventoryItem().getProduct().getName(),
                step.getInventoryItem() == null || step.getInventoryItem().getUnit() == null ? null : step.getInventoryItem().getUnit().getName(),
                step.getFeedInputMode(), step.getBagWeightKg(), step.getBagsPer1000Birds()))
                .toList();
        return new FarmingProgramResponse(program.getId(), String.format(Locale.ROOT, "CT%04d", program.getId()), program.getName(),
                program.getBreed(), program.getDurationDays(), program.getTargetWeightMin(), program.getTargetWeightMax(),
                program.getDescription(), steps, activeFlockCount, currentDay);
    }
}
