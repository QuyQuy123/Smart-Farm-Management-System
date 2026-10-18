package com.farmshift.backendFarmShift.service;

import com.farmshift.backendFarmShift.dto.request.CloseCycleRequest;
import com.farmshift.backendFarmShift.dto.request.StartCycleRequest;
import com.farmshift.backendFarmShift.dto.response.*;
import com.farmshift.backendFarmShift.entity.*;
import com.farmshift.backendFarmShift.exception.BadRequestException;
import com.farmshift.backendFarmShift.exception.ConflictException;
import com.farmshift.backendFarmShift.exception.ResourceNotFoundException;
import com.farmshift.backendFarmShift.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CycleService {
    /** All purchased flocks of one cycle must arrive within this many days of the first one (all-in / all-out). */
    public static final int MAX_IMPORT_SPREAD_DAYS = 3;
    static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final FarmingCycleRepository repository;
    private final BarnService barnService;
    private final FlockRepository flockRepository;
    private final FlockMovementRepository movementRepository;
    private final FeedRecordRepository feedRepository;
    private final WeightSampleRepository weightRepository;
    private final CycleExpenseRepository expenseRepository;

    public List<CycleSummaryResponse> list(Long barnId) {
        barnService.find(barnId);
        return repository.findAllByBarnIdOrderByCycleNumberDesc(barnId).stream().map(this::summary).toList();
    }

    @Transactional
    public CycleSummaryResponse start(Long barnId, StartCycleRequest request) {
        Barn barn = barnService.find(barnId);
        if (repository.findFirstByBarnIdAndStatus(barnId, CycleStatus.ACTIVE).isPresent()) {
            throw new ConflictException("Chuồng " + barn.getName() + " đang có lứa nuôi. Hãy kết thúc lứa hiện tại trước khi khai báo lứa mới.",
                    "CYCLE_ALREADY_ACTIVE", null);
        }
        if (request.startDate().isAfter(today())) {
            throw new BadRequestException("Ngày bắt đầu lứa không được sau ngày hôm nay.", "CYCLE_FUTURE_DATE");
        }
        if (request.hatchDate() != null && request.hatchDate().isAfter(request.startDate())) {
            throw new BadRequestException("Ngày nở (ngày tuổi 1) không được sau ngày bắt đầu lứa.", "CYCLE_HATCH_AFTER_START");
        }
        FarmingCycle cycle = new FarmingCycle();
        cycle.setBarn(barn);
        cycle.setCycleNumber(repository.maxCycleNumber(barnId) + 1);
        cycle.setStartDate(request.startDate());
        cycle.setHatchDate(request.hatchDate());
        cycle.setStatus(CycleStatus.ACTIVE);
        cycle.setNote(clean(request.note()));
        barn.setStatus(BarnStatus.ACTIVE);
        return summary(repository.saveAndFlush(cycle));
    }

    @Transactional
    public CycleSummaryResponse close(Long cycleId, CloseCycleRequest request) {
        FarmingCycle cycle = requireActive(cycleId);
        Barn barn = cycle.getBarn();
        int remaining = flockRepository.findAllByCycleIdOrderByImportDateAscIdAsc(cycleId).stream().mapToInt(Flock::getQuantity).sum();
        if (remaining > 0) {
            throw new ConflictException("Lứa nuôi còn " + remaining + " con. Hãy xuất bán, chuyển đàn hoặc ghi hao hụt hết tồn đàn trước khi kết thúc lứa.",
                    "CYCLE_HAS_ANIMALS", null);
        }
        LocalDate end = request.endDate();
        if (end.isBefore(cycle.getStartDate()) || end.isAfter(today())) {
            throw new BadRequestException("Ngày kết thúc phải từ ngày bắt đầu lứa (" + format(cycle.getStartDate()) + ") đến hôm nay.", "CYCLE_END_DATE");
        }
        LocalDate lastActivity = latest(movementRepository.lastMovementDate(cycleId), feedRepository.lastRecordDate(cycleId),
                weightRepository.lastSampleDate(cycleId), expenseRepository.lastExpenseDate(cycleId));
        if (lastActivity != null && end.isBefore(lastActivity)) {
            throw new BadRequestException("Ngày kết thúc không được trước ngày ghi nhận cuối cùng của lứa (" + format(lastActivity) + ").", "CYCLE_END_DATE");
        }
        cycle.setEndDate(end);
        cycle.setStatus(CycleStatus.CLOSED);
        if (request.note() != null && !request.note().isBlank()) {
            cycle.setNote((cycle.getNote() == null || cycle.getNote().isBlank() ? "" : cycle.getNote() + "\n") + request.note().strip());
        }
        barn.setStatus(BarnStatus.INACTIVE);
        barn.setCurrentQuantity(0);
        return summary(repository.saveAndFlush(cycle));
    }

    public CycleDetailResponse detail(Long cycleId, boolean canSeeFinance) {
        FarmingCycle cycle = find(cycleId);
        Barn barn = cycle.getBarn();
        List<Flock> flocks = flockRepository.findAllByCycleIdOrderByImportDateAscIdAsc(cycleId);
        List<FlockMovement> movements = movementRepository.findAllByFlock_Cycle_IdOrderByMovementDateAscIdAsc(cycleId);
        List<FeedRecord> feeds = feedRepository.findAllByCycleIdOrderByRecordDateDescIdDesc(cycleId);
        List<WeightSample> samples = weightRepository.findAllByCycleIdOrderBySampleDateDescIdDesc(cycleId);
        List<CycleExpense> expenses = expenseRepository.findAllByCycleIdOrderByExpenseDateDescIdDesc(cycleId);
        LocalDate reference = reference(cycle);

        CycleMetrics metrics = metrics(cycle, barn, flocks, movements, feeds, samples);
        int currentDay = metrics.ageDays() != null ? metrics.ageDays() : metrics.dayOfCycle();
        // The cycle follows the programs (breeds) of its flocks; steps are marked against each program's oldest flock.
        Map<Long, FarmingProgramResponse> programs = new LinkedHashMap<>();
        for (Flock flock : flocks) {
            FarmingProgram program = flock.getProgram();
            if (program == null || programs.containsKey(program.getId())) continue;
            long active = flocks.stream().filter(f -> f.getProgram() == program && f.getStatus() == FlockStatus.ACTIVE).count();
            programs.put(program.getId(), FarmingProgramService.response(program, active, ageOn(flock, reference)));
        }

        return new CycleDetailResponse(summary(cycle, flocks),
                BarnService.response(barn, cycle.getStatus() == CycleStatus.ACTIVE ? cycle.getId() : activeCycleId(barn)),
                metrics,
                canSeeFinance ? finance(movements, feeds, expenses, metrics) : null,
                flocks.stream().map(flock -> flockResponse(flock, reference, canSeeFinance)).toList(),
                List.copyOf(programs.values()),
                movements.stream().filter(m -> m.getType() != FlockMovementType.IMPORT)
                        .sorted(Comparator.comparing(FlockMovement::getMovementDate).thenComparing(FlockMovement::getId).reversed())
                        .map(m -> movementResponse(m, canSeeFinance)).toList(),
                feeds.stream().map(f -> new CycleRecordResponse(f.getId(), "FEED", f.getRecordDate(), f.getFeedName(), f.getQuantityKg(),
                        canSeeFinance ? f.getUnitPrice() : null, canSeeFinance ? money(f.getQuantityKg().multiply(f.getUnitPrice())) : null,
                        null, null, f.getNote(), f.getCreatedBy())).toList(),
                samples.stream().map(s -> new CycleRecordResponse(s.getId(), "WEIGHT", s.getSampleDate(), "Cân mẫu", s.getAvgWeightKg(),
                        null, null, s.getSampleSize(), null, s.getNote(), s.getCreatedBy())).toList(),
                canSeeFinance ? expenses.stream().map(e -> new CycleRecordResponse(e.getId(), "EXPENSE", e.getExpenseDate(), e.getCategory().name(),
                        null, null, e.getAmount(), null, e.getCategory().name(), e.getNote(), e.getCreatedBy())).toList() : null,
                cycle.getStatus() == CycleStatus.ACTIVE ? todayPlan(flocks) : List.of());
    }

    /** What each running flock needs today according to its program and age: feed ration, vaccines, medicine, temperature, work. */
    private static List<FlockDayPlan> todayPlan(List<Flock> flocks) {
        LocalDate today = today();
        List<FlockDayPlan> plans = new ArrayList<>();
        for (Flock flock : flocks) {
            if (flock.getStatus() != FlockStatus.ACTIVE || flock.getProgram() == null) continue;
            int age = ageOn(flock, today);
            List<FlockDayPlan.Item> items = flock.getProgram().getSteps().stream()
                    .filter(step -> age >= step.getDayFrom() && age <= step.getDayTo())
                    .sorted(Comparator.comparing(FarmingProgramStep::getCategory))
                    .map(step -> {
                        BigDecimal total = step.getCategory() == ProgramStepCategory.FEED && step.getQuantity() != null
                                ? FarmingProgramService.kg(step.getQuantity(), flock.getQuantity()) : null;
                        BigDecimal perMeal = total != null && step.getMealsPerDay() != null && step.getMealsPerDay() > 0
                                ? total.divide(BigDecimal.valueOf(step.getMealsPerDay()), 1, RoundingMode.HALF_UP) : null;
                        return new FlockDayPlan.Item(step.getCategory(), step.getName(), step.getQuantity(), step.getUnit(), step.getMealsPerDay(),
                                step.getMethod(), step.getTempMin(), step.getTempMax(), total, perMeal, step.getNote());
                    }).toList();
            plans.add(new FlockDayPlan(flock.getId(), flockCode(flock), flock.getName(), flock.getProgram().getId(), flock.getProgram().getName(),
                    age, flock.getQuantity(), items));
        }
        return plans;
    }

    // ---------------------------------------------------------------- shared rules

    FarmingCycle find(Long id) {
        return repository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lứa nuôi."));
    }

    FarmingCycle requireActive(Long id) {
        FarmingCycle cycle = find(id);
        if (cycle.getStatus() != CycleStatus.ACTIVE) {
            throw new ConflictException("Lứa nuôi đã kết thúc nên không thể ghi thêm dữ liệu.", "CYCLE_CLOSED", null);
        }
        return cycle;
    }

    /** Journal entries must fall inside the running cycle and not in the future. */
    static void checkDate(FarmingCycle cycle, LocalDate date, String label) {
        if (date.isBefore(cycle.getStartDate()) || date.isAfter(today())) {
            throw new BadRequestException(label + " phải từ ngày bắt đầu lứa (" + format(cycle.getStartDate()) + ") đến hôm nay.", "CYCLE_DATE_OUT_OF_RANGE");
        }
    }

    static LocalDate today() { return LocalDate.now(); }

    static String format(LocalDate date) { return date.format(DATE); }

    static String clean(String value) { return value == null ? "" : value.strip(); }

    static int ageOn(Flock flock, LocalDate date) {
        return flock.getAgeAtImport() + (int) ChronoUnit.DAYS.between(flock.getImportDate(), date);
    }

    static String cycleCode(FarmingCycle cycle) { return String.format(Locale.ROOT, "L%06d", cycle.getId()); }

    static String flockCode(Flock flock) { return flock == null ? null : String.format(Locale.ROOT, "H%04d", flock.getId()); }

    // ---------------------------------------------------------------- metrics

    private CycleMetrics metrics(FarmingCycle cycle, Barn barn, List<Flock> flocks, List<FlockMovement> movements,
                                 List<FeedRecord> feeds, List<WeightSample> samples) {
        LocalDate reference = reference(cycle);
        int dayOfCycle = (int) ChronoUnit.DAYS.between(cycle.getStartDate(), reference) + 1;
        Integer ageDays = cycle.getHatchDate() != null ? (int) ChronoUnit.DAYS.between(cycle.getHatchDate(), reference) + 1
                : flocks.isEmpty() ? null : ageOn(flocks.get(0), reference);

        int totalIn = 0, deaths = 0, culls = 0, harvested = 0, transferredOut = 0;
        BigDecimal inWeight = BigDecimal.ZERO, outWeight = BigDecimal.ZERO, harvestedWeight = BigDecimal.ZERO;
        for (FlockMovement m : movements) {
            BigDecimal weight = m.getWeightKg() == null ? BigDecimal.ZERO : m.getWeightKg();
            switch (m.getType()) {
                case IMPORT, TRANSFER_IN -> { totalIn += m.getQuantity(); inWeight = inWeight.add(weight); }
                case DEATH -> deaths += m.getQuantity();
                case CULL -> { culls += m.getQuantity(); outWeight = outWeight.add(weight); }
                case HARVEST -> { harvested += m.getQuantity(); outWeight = outWeight.add(weight); harvestedWeight = harvestedWeight.add(weight); }
                case TRANSFER_OUT -> { transferredOut += m.getQuantity(); outWeight = outWeight.add(weight); }
            }
        }
        int current = flocks.stream().mapToInt(Flock::getQuantity).sum();
        BigDecimal avgWeight = samples.stream().filter(s -> !s.getSampleDate().isAfter(reference)).findFirst()
                .map(WeightSample::getAvgWeightKg)
                .orElse(totalIn == 0 ? null : inWeight.divide(BigDecimal.valueOf(totalIn), 3, RoundingMode.HALF_UP));
        BigDecimal biomass = avgWeight == null ? BigDecimal.ZERO : avgWeight.multiply(BigDecimal.valueOf(current)).setScale(1, RoundingMode.HALF_UP);
        BigDecimal feedKg = feeds.stream().map(FeedRecord::getQuantityKg).reduce(BigDecimal.ZERO, BigDecimal::add);
        // FCR = cám tiêu thụ / khối lượng tăng (hiện có + đã ra khỏi chuồng - khối lượng lúc vào).
        BigDecimal gain = biomass.add(outWeight).subtract(inWeight);
        BigDecimal fcr = gain.signum() > 0 && feedKg.signum() > 0 ? feedKg.divide(gain, 2, RoundingMode.HALF_UP) : null;
        BigDecimal density = barn.getAreaM2() == null || barn.getAreaM2().signum() <= 0 ? null
                : BigDecimal.valueOf(current).divide(barn.getAreaM2(), 1, RoundingMode.HALF_UP);
        LocalDate firstImport = flocks.stream().filter(f -> f.getSourceType() == FlockSource.PURCHASE)
                .map(Flock::getImportDate).min(Comparator.naturalOrder()).orElse(null);

        return new CycleMetrics(dayOfCycle, ageDays, totalIn, current, deaths, culls, harvested, transferredOut,
                rate(deaths, totalIn), rate(culls, totalIn), rate(harvested, totalIn), avgWeight, biomass, density, feedKg,
                gain.setScale(1, RoundingMode.HALF_UP), fcr, harvestedWeight, firstImport,
                firstImport == null ? null : firstImport.plusDays(MAX_IMPORT_SPREAD_DAYS), barn.getCapacity());
    }

    private CycleFinance finance(List<FlockMovement> movements, List<FeedRecord> feeds, List<CycleExpense> expenses, CycleMetrics metrics) {
        BigDecimal chicks = BigDecimal.ZERO, revenue = BigDecimal.ZERO;
        for (FlockMovement m : movements) {
            BigDecimal value = m.getFlock().getUnitPrice().multiply(BigDecimal.valueOf(m.getQuantity()));
            switch (m.getType()) {
                case IMPORT, TRANSFER_IN -> chicks = chicks.add(value);
                case TRANSFER_OUT -> chicks = chicks.subtract(value);
                case HARVEST -> revenue = revenue.add(m.getWeightKg().multiply(m.getUnitPrice()));
                default -> { }
            }
        }
        BigDecimal feed = feeds.stream().map(f -> f.getQuantityKg().multiply(f.getUnitPrice())).reduce(BigDecimal.ZERO, BigDecimal::add);
        Map<String, BigDecimal> byCategory = new LinkedHashMap<>();
        for (ExpenseCategory category : ExpenseCategory.values()) byCategory.put(category.name(), BigDecimal.ZERO);
        for (CycleExpense e : expenses) byCategory.merge(e.getCategory().name(), e.getAmount(), BigDecimal::add);
        byCategory.replaceAll((key, value) -> money(value));
        BigDecimal total = byCategory.values().stream().reduce(chicks.add(feed), BigDecimal::add);
        BigDecimal producedKg = metrics.biomassKg().add(metrics.harvestedWeightKg());
        return new CycleFinance(money(chicks), money(feed), byCategory, money(total),
                producedKg.signum() > 0 ? total.divide(producedKg, 0, RoundingMode.HALF_UP) : null,
                metrics.currentQuantity() > 0 ? total.divide(BigDecimal.valueOf(metrics.currentQuantity()), 0, RoundingMode.HALF_UP) : null,
                money(revenue), money(revenue.subtract(total)));
    }

    // ---------------------------------------------------------------- mapping

    private Long activeCycleId(Barn barn) {
        return repository.findFirstByBarnIdAndStatus(barn.getId(), CycleStatus.ACTIVE).map(FarmingCycle::getId).orElse(null);
    }

    private static LocalDate reference(FarmingCycle cycle) {
        return cycle.getEndDate() != null ? cycle.getEndDate() : today();
    }

    private static BigDecimal rate(int part, int total) {
        return total == 0 ? null : BigDecimal.valueOf(part * 100.0 / total).setScale(2, RoundingMode.HALF_UP);
    }

    private static BigDecimal money(BigDecimal value) { return value.setScale(0, RoundingMode.HALF_UP); }

    private static LocalDate latest(LocalDate... dates) {
        return Arrays.stream(dates).filter(Objects::nonNull).max(Comparator.naturalOrder()).orElse(null);
    }

    private CycleSummaryResponse summary(FarmingCycle cycle) {
        return summary(cycle, flockRepository.findAllByCycleIdOrderByImportDateAscIdAsc(cycle.getId()));
    }

    private CycleSummaryResponse summary(FarmingCycle cycle, List<Flock> flocks) {
        return new CycleSummaryResponse(cycle.getId(), cycleCode(cycle), cycle.getBarn().getId(), cycle.getCycleNumber(),
                cycle.getStartDate(), cycle.getHatchDate(), cycle.getEndDate(), cycle.getStatus(), cycle.getNote(),
                flocks.stream().filter(f -> f.getSourceType() == FlockSource.PURCHASE || f.getSourceType() == FlockSource.TRANSFER)
                        .mapToInt(Flock::getImportQuantity).sum(),
                flocks.stream().mapToInt(Flock::getQuantity).sum());
    }

    static FlockResponse flockResponse(Flock flock, LocalDate reference, boolean canSeeFinance) {
        int age = ageOn(flock, reference);
        FarmingProgram program = flock.getProgram();
        return new FlockResponse(flock.getId(), flockCode(flock), flock.getName(), program == null ? null : program.getId(),
                program == null ? null : program.getName(), flock.getGender(), flock.getSourceType(),
                flock.getSourceNote(), flockCode(flock.getSourceFlock()), flock.getImportDate(), flock.getAgeAtImport(), age,
                flock.getImportQuantity(), flock.getImportAvgWeight(),
                flock.getImportAvgWeight().multiply(BigDecimal.valueOf(flock.getImportQuantity())).setScale(1, RoundingMode.HALF_UP),
                canSeeFinance ? flock.getUnitPrice() : null, flock.getQuantity(), flock.getStatus(), flock.getNote());
    }

    static FlockMovementResponse movementResponse(FlockMovement m, boolean canSeeFinance) {
        boolean sale = m.getType() == FlockMovementType.HARVEST && canSeeFinance;
        return new FlockMovementResponse(m.getId(), m.getFlock().getId(), flockCode(m.getFlock()), m.getFlock().getName(), m.getType(),
                m.getMovementDate(), m.getQuantity(), m.getWeightKg(), sale ? m.getUnitPrice() : null,
                sale ? money(m.getWeightKg().multiply(m.getUnitPrice())) : null, flockCode(m.getRelatedFlock()), m.getNote(), m.getCreatedBy());
    }
}
