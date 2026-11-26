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
import org.springframework.beans.factory.annotation.Autowired;
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
    public static final java.time.ZoneId VN_ZONE = java.time.ZoneId.of("Asia/Bangkok");
    static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final FarmingCycleRepository repository;
    private final BarnService barnService;
    private final FlockRepository flockRepository;
    private final FlockMovementRepository movementRepository;
    private final FeedRecordRepository feedRepository;
    private final WeightSampleRepository weightRepository;
    private final CycleExpenseRepository expenseRepository;
    private final CycleCarriedExpenseRepository carriedExpenseRepository;
    private final PurchaseInvoiceRepository invoiceRepository;

    @Autowired(required = false)
    private BarnRepository barnRepository;

    @Autowired(required = false)
    private CycleDiseaseRepository cycleDiseaseRepository;

    @Autowired(required = false)
    private DiseaseTreatmentLogRepository diseaseTreatmentLogRepository;

    @Autowired(required = false)
    private WorkAssignmentService workAssignmentService;

    @jakarta.persistence.PersistenceContext
    private jakarta.persistence.EntityManager entityManager;

    /**
     * Tổng hợp toàn bộ lứa nuôi đã kết thúc (CLOSED) toàn trại với batch loading chống N+1 (OPS-03).
     * Khi workerEmail != null chỉ trả các lứa thuộc chuồng công nhân được phân công và ẩn toàn bộ dữ liệu tài chính.
     */
    public List<CycleHistoryItemResponse> closedHistory(
            Long areaId, Long barnId, Long programId,
            LocalDate from, LocalDate to, String search,
            boolean canSeeFinance, String workerEmail
    ) {
        Set<Long> workerBarns = null;
        if (workerEmail != null && workAssignmentService != null) {
            workerBarns = new HashSet<>();
            var workersByBarn = workAssignmentService.workersByBarn();
            for (var entry : workersByBarn.entrySet()) {
                if (entry.getValue().stream().anyMatch(w -> w.email() != null && w.email().equalsIgnoreCase(workerEmail))) {
                    workerBarns.add(entry.getKey());
                }
            }
            if (workerBarns.isEmpty()) return List.of();
        }

        final Set<Long> allowedBarns = workerBarns;
        List<FarmingCycle> closedCycles = repository.findAllWithBarnAndAreaByStatus(CycleStatus.CLOSED).stream()
                .filter(c -> allowedBarns == null || allowedBarns.contains(c.getBarn().getId()))
                .filter(c -> areaId == null || (c.getBarn().getArea() != null && areaId.equals(c.getBarn().getArea().getId())))
                .filter(c -> barnId == null || barnId.equals(c.getBarn().getId()))
                .filter(c -> from == null || (c.getEndDate() != null && !c.getEndDate().isBefore(from)))
                .filter(c -> to == null || (c.getEndDate() != null && !c.getEndDate().isAfter(to)))
                .sorted(Comparator.comparing(FarmingCycle::getEndDate, Comparator.nullsLast(Comparator.reverseOrder()))
                        .thenComparing(FarmingCycle::getId, Comparator.reverseOrder()))
                .toList();

        if (closedCycles.isEmpty()) return List.of();

        List<Long> cycleIds = closedCycles.stream().map(FarmingCycle::getId).toList();

        Map<Long, List<Flock>> flocksByCycle = new HashMap<>();
        for (Flock f : flockRepository.findByCycleIdInOrderByImportDateAscIdAsc(cycleIds)) {
            if (f.getCycle() != null) {
                flocksByCycle.computeIfAbsent(f.getCycle().getId(), ignored -> new ArrayList<>()).add(f);
            }
        }
        Map<Long, List<FlockMovement>> movementsByCycle = new HashMap<>();
        for (FlockMovement m : movementRepository.findByFlock_Cycle_IdInOrderByMovementDateAscIdAsc(cycleIds)) {
            if (m.getFlock() != null && m.getFlock().getCycle() != null) {
                movementsByCycle.computeIfAbsent(m.getFlock().getCycle().getId(), ignored -> new ArrayList<>()).add(m);
            }
        }
        Map<Long, List<FeedRecord>> feedsByCycle = new HashMap<>();
        for (FeedRecord record : feedRepository.findByCycleIdInOrderByRecordDateDescIdDesc(cycleIds)) {
            if (record.getCycle() != null) {
                feedsByCycle.computeIfAbsent(record.getCycle().getId(), ignored -> new ArrayList<>()).add(record);
            }
        }
        Map<Long, List<WeightSample>> samplesByCycle = new HashMap<>();
        for (WeightSample sample : weightRepository.findByCycleIdInOrderBySampleDateDescIdDesc(cycleIds)) {
            if (sample.getCycle() != null) {
                samplesByCycle.computeIfAbsent(sample.getCycle().getId(), ignored -> new ArrayList<>()).add(sample);
            }
        }

        Map<Long, List<CycleExpense>> expensesByCycle = new HashMap<>();
        Map<Long, List<CycleCarriedExpense>> carriedByCycle = new HashMap<>();
        if (canSeeFinance) {
            for (CycleExpense e : expenseRepository.findWithCycleByCycleIdIn(cycleIds)) {
                if (e.getCycle() != null) {
                    expensesByCycle.computeIfAbsent(e.getCycle().getId(), ignored -> new ArrayList<>()).add(e);
                }
            }
            for (CycleCarriedExpense c : carriedExpenseRepository.findWithCycleByCycleIdIn(cycleIds)) {
                if (c.getCycle() != null) {
                    carriedByCycle.computeIfAbsent(c.getCycle().getId(), ignored -> new ArrayList<>()).add(c);
                }
            }
        }

        // Batch-load diseases & treatment costs from Phase 2 (OPS-02)
        Map<Long, Integer> diseaseCountByCycle = new HashMap<>();
        Map<Long, BigDecimal> diseaseCostByCycle = new HashMap<>();
        if (cycleDiseaseRepository != null) {
            List<CycleDisease> allDiseases = cycleDiseaseRepository.findAllByCycleIdIn(cycleIds);
            Map<Long, Long> diseaseToCycle = new HashMap<>();
            for (CycleDisease d : allDiseases) {
                Long cid = d.getCycle().getId();
                diseaseToCycle.put(d.getId(), cid);
                diseaseCountByCycle.merge(cid, 1, Integer::sum);
            }
            if (canSeeFinance && !diseaseToCycle.isEmpty() && diseaseTreatmentLogRepository != null) {
                for (DiseaseTreatmentLog log : diseaseTreatmentLogRepository.findAllByDiseaseIdInOrderByTreatmentDateAscIdAsc(diseaseToCycle.keySet())) {
                    Long cid = diseaseToCycle.get(log.getDisease().getId());
                    if (cid != null && log.getCost() != null) {
                        diseaseCostByCycle.merge(cid, log.getCost(), BigDecimal::add);
                    }
                }
            }
        }

        String keyword = search == null ? "" : search.strip().toLowerCase(Locale.ROOT);
        List<CycleHistoryItemResponse> result = new ArrayList<>();
        for (FarmingCycle cycle : closedCycles) {
            Long id = cycle.getId();
            Barn barn = cycle.getBarn();
            FarmArea area = barn.getArea();
            List<Flock> flocks = flocksByCycle.getOrDefault(id, List.of());

            Set<Long> progIds = new LinkedHashSet<>();
            Set<String> progNames = new LinkedHashSet<>();
            Set<String> breeds = new LinkedHashSet<>();
            for (Flock flock : flocks) {
                if (flock.getProgram() != null) {
                    progIds.add(flock.getProgram().getId());
                    progNames.add(flock.getProgram().getName());
                    if (flock.getProgram().getBreed() != null && !flock.getProgram().getBreed().isBlank()) {
                        breeds.add(flock.getProgram().getBreed());
                    }
                }
            }
            if (programId != null && !progIds.contains(programId)) continue;

            String code = cycleCode(cycle);
            if (!keyword.isEmpty()) {
                String haystack = (code + " lứa thứ " + cycle.getCycleNumber() + " "
                        + barn.getName() + " " + (area != null ? area.getName() : "") + " "
                        + String.join(" ", progNames) + " " + String.join(" ", breeds) + " "
                        + (cycle.getNote() != null ? cycle.getNote() : "")).toLowerCase(Locale.ROOT);
                if (!haystack.contains(keyword)) continue;
            }

            List<FlockMovement> movements = movementsByCycle.getOrDefault(id, List.of());
            List<FeedRecord> feeds = feedsByCycle.getOrDefault(id, List.of());
            List<WeightSample> samples = samplesByCycle.getOrDefault(id, List.of());
            CycleMetrics m = metrics(cycle, barn, flocks, movements, feeds, samples);

            BigDecimal survivalRate = m.totalIn() > 0
                    ? BigDecimal.valueOf(Math.max(0, m.totalIn() - m.deaths() - m.culls()))
                        .multiply(BigDecimal.valueOf(100))
                        .divide(BigDecimal.valueOf(m.totalIn()), 2, RoundingMode.HALF_UP)
                    : null;
            BigDecimal avgHarvestWeight = m.harvestedQuantity() > 0 && m.harvestedWeightKg() != null
                    ? m.harvestedWeightKg().divide(BigDecimal.valueOf(m.harvestedQuantity()), 3, RoundingMode.HALF_UP)
                    : m.avgWeightKg();

            CycleFinance f = canSeeFinance
                    ? finance(cycle, movements, feeds, expensesByCycle.getOrDefault(id, List.of()),
                        carriedByCycle.getOrDefault(id, List.of()), m)
                    : null;
            BigDecimal diseaseMedCost = canSeeFinance
                    ? diseaseCostByCycle.getOrDefault(id, BigDecimal.ZERO).setScale(0, RoundingMode.HALF_UP)
                    : null;

            result.add(new CycleHistoryItemResponse(
                    id, code, cycle.getCycleNumber(),
                    barn.getId(), barn.getName(),
                    area == null ? null : area.getId(), area == null ? "" : area.getName(),
                    cycle.getStartDate(), cycle.getEndDate(), m.dayOfCycle(),
                    List.copyOf(progIds), List.copyOf(progNames), List.copyOf(breeds),
                    m.totalIn(), m.harvestedQuantity(), m.deaths(), m.culls(), survivalRate,
                    m.feedKg(), m.fcr(), m.harvestedWeightKg(), avgHarvestWeight,
                    diseaseCountByCycle.getOrDefault(id, 0), diseaseMedCost,
                    f == null ? null : f.totalCost(),
                    f == null ? null : f.revenue(),
                    f == null ? null : f.profit(),
                    f == null ? null : f.costPerKg()
            ));
        }
        return result;
    }

    public List<CycleSummaryResponse> list(Long barnId) {
        barnService.find(barnId);
        List<FarmingCycle> cycles = repository.findAllByBarnIdOrderByCycleNumberDesc(barnId);
        if (cycles.isEmpty()) {
            return List.of();
        }
        List<Long> cycleIds = cycles.stream().map(FarmingCycle::getId).toList();
        Map<Long, List<Flock>> flocksByCycle = flockRepository.findByCycleIdInOrderByImportDateAscIdAsc(cycleIds).stream()
                .collect(java.util.stream.Collectors.groupingBy(f -> f.getCycle().getId()));
        return cycles.stream()
                .map(cycle -> summary(cycle, flocksByCycle.getOrDefault(cycle.getId(), List.of())))
                .toList();
    }

    @Transactional
    public CycleSummaryResponse start(Long barnId, StartCycleRequest request) {
        Barn barn = lockBarn(barnId);
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

    /** Mở lứa cho chuồng trống khi tách đàn sang: lứa bắt đầu đúng ngày chuyển, ngày nở theo lứa gốc. */
    FarmingCycle openForTransfer(Barn barn, LocalDate date, FarmingCycle source) {
        LocalDate hatchDate = source.getHatchDate();
        String fromBarn = source.getBarn().getName();
        int carriedDays = source.getCarriedDays() + (int) ChronoUnit.DAYS.between(source.getStartDate(), date);
        LocalDate lastEnd = repository.lastEndDate(barn.getId());
        if (lastEnd != null && date.isBefore(lastEnd)) {
            throw new BadRequestException("Ngày chuyển đàn không được trước ngày kết thúc lứa trước của chuồng " + barn.getName() + " (" + format(lastEnd) + ").",
                    "TRANSFER_BEFORE_LAST_CYCLE");
        }
        FarmingCycle cycle = new FarmingCycle();
        cycle.setBarn(barn);
        cycle.setCycleNumber(repository.maxCycleNumber(barn.getId()) + 1);
        cycle.setStartDate(date);
        cycle.setHatchDate(hatchDate);
        cycle.setCarriedDays(carriedDays);
        cycle.setStatus(CycleStatus.ACTIVE);
        cycle.setNote("Mở khi tách đàn từ " + fromBarn);
        barn.setStatus(BarnStatus.ACTIVE);
        return repository.saveAndFlush(cycle);
    }

    /**
     * Tách đàn: phần cám đã ăn, tiền cám, khối lượng đã tăng và các khoản chi của số con chuyển đi theo đàn sang lứa đích
     * (tính theo đầu con), như giá vốn con giống. Gọi trước khi trừ số con ở đàn gốc.
     */
    void carryWithFlock(FarmingCycle from, FarmingCycle to, int moved) {
        Long id = from.getId();
        List<FeedRecord> feeds = feedRepository.findAllByCycleIdOrderByRecordDateDescIdDesc(id);
        CycleMetrics metrics = metrics(from, from.getBarn(), flockRepository.findAllByCycleIdOrderByImportDateAscIdAsc(id),
                movementRepository.findAllByFlock_Cycle_IdOrderByMovementDateAscIdAsc(id), feeds, weightRepository.findAllByCycleIdOrderBySampleDateDescIdDesc(id));
        int current = metrics.currentQuantity();
        if (current <= 0) return;
        BigDecimal feedKg = share(metrics.feedKg(), moved, current);
        BigDecimal feedCost = share(feedCost(from, feeds), moved, current);
        BigDecimal gainKg = share(metrics.weightGainKg().max(BigDecimal.ZERO), moved, current);
        from.setCarriedFeedKg(from.getCarriedFeedKg().subtract(feedKg));
        from.setCarriedFeedCost(from.getCarriedFeedCost().subtract(feedCost));
        from.setCarriedGainKg(from.getCarriedGainKg().subtract(gainKg));
        to.setCarriedFeedKg(to.getCarriedFeedKg().add(feedKg));
        to.setCarriedFeedCost(to.getCarriedFeedCost().add(feedCost));
        to.setCarriedGainKg(to.getCarriedGainKg().add(gainKg));
        expenseTotals(id).forEach((category, amount) -> {
            BigDecimal part = share(amount, moved, current);
            addCarriedExpense(from, category, part.negate());
            addCarriedExpense(to, category, part);
        });
    }

    /** Khoản chi của lứa theo loại, gồm phần đã nhận / đã chuyển khi tách đàn. */
    private Map<ExpenseCategory, BigDecimal> expenseTotals(Long cycleId) {
        Map<ExpenseCategory, BigDecimal> totals = new EnumMap<>(ExpenseCategory.class);
        expenseRepository.findAllByCycleIdOrderByExpenseDateDescIdDesc(cycleId).forEach(e -> totals.merge(e.getCategory(), e.getAmount(), BigDecimal::add));
        carriedExpenseRepository.findAllByCycleId(cycleId).forEach(e -> totals.merge(e.getCategory(), e.getAmount(), BigDecimal::add));
        return totals;
    }

    private void addCarriedExpense(FarmingCycle cycle, ExpenseCategory category, BigDecimal delta) {
        CycleCarriedExpense carried = carriedExpenseRepository.findByCycleIdAndCategory(cycle.getId(), category).orElseGet(() -> {
            CycleCarriedExpense created = new CycleCarriedExpense();
            created.setCycle(cycle);
            created.setCategory(category);
            return created;
        });
        carried.setAmount(carried.getAmount().add(delta));
        carriedExpenseRepository.save(carried);
    }

    private static BigDecimal share(BigDecimal value, int part, int whole) {
        return value.multiply(BigDecimal.valueOf(part)).divide(BigDecimal.valueOf(whole), 3, RoundingMode.HALF_UP);
    }

    private static BigDecimal feedCost(FarmingCycle cycle, List<FeedRecord> feeds) {
        return feeds.stream().map(f -> f.getQuantityKg().multiply(f.getUnitPrice())).reduce(cycle.getCarriedFeedCost(), BigDecimal::add);
    }

    @Transactional
    public CycleSummaryResponse close(Long cycleId, CloseCycleRequest request) {
        FarmingCycle cycle = requireActive(cycleId);
        Barn barn = lockBarn(cycle.getBarn().getId());
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

    record DashboardCycleSnapshot(
            CycleMetrics metrics,
            CycleFinance finance,
            List<Flock> flocks,
            List<FlockMovement> movements,
            List<WeightSample> weightSamples,
            List<FarmingProgramResponse> programs
    ) { }

    Map<Long, DashboardCycleSnapshot> dashboardSnapshots(
            List<FarmingCycle> cycles,
            Map<Long, List<Flock>> flocksByCycle,
            Map<Long, List<FlockMovement>> movementsByCycle,
            boolean canSeeFinance) {
        if (cycles == null || cycles.isEmpty()) {
            return Map.of();
        }
        List<Long> cycleIds = cycles.stream().map(FarmingCycle::getId).toList();
        Map<Long, List<FeedRecord>> feedsByCycle = new HashMap<>();
        for (FeedRecord record : feedRepository.findByCycleIdInOrderByRecordDateDescIdDesc(cycleIds)) {
            if (record.getCycle() != null) {
                feedsByCycle.computeIfAbsent(record.getCycle().getId(), ignored -> new ArrayList<>()).add(record);
            }
        }
        Map<Long, List<WeightSample>> samplesByCycle = new HashMap<>();
        for (WeightSample sample : weightRepository.findByCycleIdInOrderBySampleDateDescIdDesc(cycleIds)) {
            if (sample.getCycle() != null) {
                samplesByCycle.computeIfAbsent(sample.getCycle().getId(), ignored -> new ArrayList<>()).add(sample);
            }
        }
        Map<Long, List<CycleExpense>> expensesByCycle = new HashMap<>();
        Map<Long, List<CycleCarriedExpense>> carriedByCycle = new HashMap<>();
        if (canSeeFinance) {
            for (CycleExpense expense : expenseRepository.findWithCycleByCycleIdIn(cycleIds)) {
                if (expense.getCycle() != null) {
                    expensesByCycle.computeIfAbsent(expense.getCycle().getId(), ignored -> new ArrayList<>()).add(expense);
                }
            }
            for (CycleCarriedExpense carried : carriedExpenseRepository.findWithCycleByCycleIdIn(cycleIds)) {
                if (carried.getCycle() != null) {
                    carriedByCycle.computeIfAbsent(carried.getCycle().getId(), ignored -> new ArrayList<>()).add(carried);
                }
            }
        }

        Map<Long, DashboardCycleSnapshot> snapshots = new LinkedHashMap<>();
        for (FarmingCycle cycle : cycles) {
            Long id = cycle.getId();
            Barn barn = cycle.getBarn();
            List<Flock> flocks = flocksByCycle.getOrDefault(id, List.of());
            List<FlockMovement> movements = movementsByCycle.getOrDefault(id, List.of());
            List<FeedRecord> feeds = feedsByCycle.getOrDefault(id, List.of());
            List<WeightSample> samples = samplesByCycle.getOrDefault(id, List.of());
            List<CycleExpense> expenses = expensesByCycle.getOrDefault(id, List.of());
            List<CycleCarriedExpense> carried = carriedByCycle.getOrDefault(id, List.of());

            LocalDate reference = reference(cycle);
            CycleMetrics metrics = metrics(cycle, barn, flocks, movements, feeds, samples);
            CycleFinance cycleFinance = canSeeFinance ? finance(cycle, movements, feeds, expenses, carried, metrics) : null;

            Map<Long, FarmingProgramResponse> programs = new LinkedHashMap<>();
            for (Flock flock : flocks) {
                FarmingProgram program = flock.getProgram();
                if (program == null || programs.containsKey(program.getId())) continue;
                long active = flocks.stream().filter(f -> f.getProgram() == program && f.getStatus() == FlockStatus.ACTIVE).count();
                programs.put(program.getId(), FarmingProgramService.response(program, active, ageOn(flock, reference)));
            }

            snapshots.put(id, new DashboardCycleSnapshot(metrics, cycleFinance, flocks, movements, samples, List.copyOf(programs.values())));
        }
        return snapshots;
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
        Map<Long, PurchaseInvoice> invoices = new HashMap<>();
        if (canSeeFinance && !flocks.isEmpty()) {
            invoiceRepository.findAllByFlockIdIn(flocks.stream().map(Flock::getId).toList())
                    .forEach(invoice -> invoices.putIfAbsent(invoice.getFlock().getId(), invoice));
        }

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
                canSeeFinance ? finance(cycle, movements, feeds, expenses, metrics) : null,
                flocks.stream().map(flock -> flockResponse(flock, reference, canSeeFinance, invoices.get(flock.getId()))).toList(),
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
                        null, null, e.getAmount(), null, e.getCategory().name(), e.getNote(), e.getCreatedBy())).toList() : null);
    }

    // ---------------------------------------------------------------- shared rules

    /** Chuồng của lứa nuôi, để kiểm tra công nhân có phụ trách chuồng đó không. */
    @Transactional(readOnly = true)
    public Long barnIdOf(Long id) {
        return find(id).getBarn().getId();
    }

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

    static LocalDate today() { return LocalDate.now(VN_ZONE); }

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
        int dayOfCycle = (int) ChronoUnit.DAYS.between(cycle.getStartDate(), reference) + 1 + cycle.getCarriedDays();
        // Integer.valueOf keeps the whole conditional boxed: with (int) a fresh cycle without hatch date or flocks unboxed null (NPE).
        Integer ageDays = cycle.getHatchDate() != null ? Integer.valueOf((int) ChronoUnit.DAYS.between(cycle.getHatchDate(), reference) + 1)
                : flocks.isEmpty() ? null : Integer.valueOf(ageOn(flocks.get(0), reference));

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
        BigDecimal rawBiomass = avgWeight == null ? BigDecimal.ZERO : avgWeight.multiply(BigDecimal.valueOf(current));
        BigDecimal biomass = rawBiomass.setScale(1, RoundingMode.HALF_UP);
        BigDecimal feedKg = feeds.stream().map(FeedRecord::getQuantityKg).reduce(cycle.getCarriedFeedKg(), BigDecimal::add);
        // FCR = cám tiêu thụ / khối lượng tăng (hiện có + đã ra khỏi chuồng - khối lượng lúc vào).
        BigDecimal gain = rawBiomass.add(outWeight).subtract(inWeight).add(cycle.getCarriedGainKg());
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

    private CycleFinance finance(FarmingCycle cycle, List<FlockMovement> movements, List<FeedRecord> feeds, List<CycleExpense> expenses, CycleMetrics metrics) {
        return finance(cycle, movements, feeds, expenses, carriedExpenseRepository.findAllByCycleId(cycle.getId()), metrics);
    }

    private CycleFinance finance(FarmingCycle cycle, List<FlockMovement> movements, List<FeedRecord> feeds, List<CycleExpense> expenses,
                                 List<CycleCarriedExpense> carriedExpenses, CycleMetrics metrics) {
        BigDecimal chicks = BigDecimal.ZERO, revenue = BigDecimal.ZERO;
        for (FlockMovement m : movements) {
            BigDecimal unitPrice = m.getFlock() != null && m.getFlock().getUnitPrice() != null ? m.getFlock().getUnitPrice() : BigDecimal.ZERO;
            BigDecimal value = unitPrice.multiply(BigDecimal.valueOf(m.getQuantity()));
            switch (m.getType()) {
                case IMPORT, TRANSFER_IN -> chicks = chicks.add(value);
                case TRANSFER_OUT -> chicks = chicks.subtract(value);
                case HARVEST -> {
                    if (m.getWeightKg() != null && m.getUnitPrice() != null) {
                        revenue = revenue.add(m.getWeightKg().multiply(m.getUnitPrice()));
                    }
                }
                default -> { }
            }
        }
        BigDecimal feed = feedCost(cycle, feeds);
        Map<String, BigDecimal> byCategory = new LinkedHashMap<>();
        for (ExpenseCategory category : ExpenseCategory.values()) byCategory.put(category.name(), BigDecimal.ZERO);
        for (CycleExpense e : expenses) byCategory.merge(e.getCategory().name(), e.getAmount(), BigDecimal::add);
        carriedExpenses.forEach(e -> byCategory.merge(e.getCategory().name(), e.getAmount(), BigDecimal::add));
        byCategory.replaceAll((key, value) -> money(value));
        BigDecimal total = byCategory.entrySet().stream()
            .filter(entry -> ExpenseCategory.valueOf(entry.getKey()).countsInCycleCost())
            .map(Map.Entry::getValue)
            .reduce(chicks.add(feed), BigDecimal::add);
        BigDecimal producedKg = metrics.biomassKg().add(metrics.harvestedWeightKg());
        return new CycleFinance(money(chicks), money(feed), byCategory, money(total),
                producedKg.signum() > 0 ? total.divide(producedKg, 0, RoundingMode.HALF_UP) : null,
                metrics.currentQuantity() > 0 ? total.divide(BigDecimal.valueOf(metrics.currentQuantity()), 0, RoundingMode.HALF_UP) : null,
                money(revenue), money(revenue.subtract(total)));
    }

    // ---------------------------------------------------------------- mapping

    private Barn lockBarn(Long barnId) {
        if (barnRepository != null) {
            Barn locked = barnRepository.findByIdForUpdate(barnId)
                    .or(() -> barnRepository.findById(barnId))
                    .orElse(null);
            if (locked != null) {
                if (entityManager != null && entityManager.contains(locked)) {
                    entityManager.refresh(locked);
                }
                return locked;
            }
        }
        return barnService.find(barnId);
    }

    private Long activeCycleId(Barn barn) {
        return repository.findFirstByBarnIdAndStatus(barn.getId(), CycleStatus.ACTIVE).map(FarmingCycle::getId).orElse(null);
    }

    private static LocalDate reference(FarmingCycle cycle) {
        return cycle.getEndDate() != null ? cycle.getEndDate() : today();
    }

    private static BigDecimal rate(int part, int total) {
        return total == 0 ? null : BigDecimal.valueOf(part)
                .multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(total), 2, RoundingMode.HALF_UP);
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
        return flockResponse(flock, reference, canSeeFinance, null);
    }

    /** invoice: hóa đơn nhập con giống của đàn (nếu có); chỉ trả về cho vai trò được xem chi phí. */
    static FlockResponse flockResponse(Flock flock, LocalDate reference, boolean canSeeFinance, PurchaseInvoice invoice) {
        int age = ageOn(flock, reference);
        FarmingProgram program = flock.getProgram();
        Supplier supplier = flock.getSupplier();
        PurchaseInvoice visibleInvoice = canSeeFinance ? invoice : null;
        return new FlockResponse(flock.getId(), flockCode(flock), flock.getName(), program == null ? null : program.getId(),
                program == null ? null : program.getName(), flock.getGender(), flock.getSourceType(),
                flock.getSourceNote(), flockCode(flock.getSourceFlock()), flock.getImportDate(), flock.getAgeAtImport(), age,
                flock.getImportQuantity(), flock.getImportAvgWeight(),
                flock.getImportAvgWeight().multiply(BigDecimal.valueOf(flock.getImportQuantity())).setScale(1, RoundingMode.HALF_UP),
                canSeeFinance ? flock.getUnitPrice() : null, flock.getQuantity(), flock.getStatus(), flock.getNote(),
                supplier == null ? null : supplier.getId(), supplier == null ? null : supplier.getName(),
                visibleInvoice == null ? null : visibleInvoice.getId(), visibleInvoice == null ? null : visibleInvoice.getCode());
    }

    static FlockMovementResponse movementResponse(FlockMovement m, boolean canSeeFinance) {
        boolean sale = m.getType() == FlockMovementType.HARVEST && canSeeFinance;
        return new FlockMovementResponse(m.getId(), m.getFlock().getId(), flockCode(m.getFlock()), m.getFlock().getName(), m.getType(),
                m.getMovementDate(), m.getQuantity(), m.getWeightKg(), sale ? m.getUnitPrice() : null,
                sale ? money(m.getWeightKg().multiply(m.getUnitPrice())) : null, flockCode(m.getRelatedFlock()), m.getNote(), m.getCreatedBy(),
                m.getPhotoUrls() == null ? List.of() : List.of(m.getPhotoUrls().split("\n")));
    }
}
