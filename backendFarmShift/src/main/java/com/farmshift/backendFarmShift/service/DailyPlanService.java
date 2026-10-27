package com.farmshift.backendFarmShift.service;

import com.farmshift.backendFarmShift.dto.request.DailyTaskConfirmRequest;
import com.farmshift.backendFarmShift.dto.response.BarnDayPlan;
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
import java.time.LocalDateTime;
import java.util.*;

import static com.farmshift.backendFarmShift.service.CycleService.*;

/**
 * Phiếu việc hằng ngày theo chương trình nuôi. Chủ trại khai báo định mức cho 1 con; mỗi ngày hệ thống nhân với số con còn lại
 * của từng đàn (đã trừ hao hụt, xuất bán, chuyển đàn) và gộp theo chuồng. Công nhân chỉ bấm xác nhận; khi xác nhận cám,
 * thuốc, vắc-xin có gắn hàng hóa thì trừ tồn kho và ghi chi phí vào lứa trong cùng một giao dịch.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DailyPlanService {
    /** Lệch kế hoạch quá mức này phải ghi lý do: cám ±10%, thuốc và vắc-xin ±1% (chỉ chấp nhận sai số làm tròn). */
    private static final BigDecimal FEED_TOLERANCE = new BigDecimal("0.10");
    private static final BigDecimal DOSE_TOLERANCE = new BigDecimal("0.01");
    private static final List<ProgramStepCategory> ORDER = List.of(ProgramStepCategory.FEED, ProgramStepCategory.VACCINE,
            ProgramStepCategory.MEDICINE, ProgramStepCategory.TEMPERATURE, ProgramStepCategory.WORK);

    private final CycleService cycleService;
    private final FarmingCycleRepository cycleRepository;
    private final FlockRepository flockRepository;
    private final FlockMovementRepository movementRepository;
    private final DailyTaskLogRepository logRepository;
    private final InventoryItemRepository inventoryRepository;
    private final FeedRecordRepository feedRepository;
    private final CycleExpenseRepository expenseRepository;
    private final jakarta.persistence.EntityManager entityManager;
    private final WorkAssignmentService workAssignment;

    /** Phiếu việc của mọi chuồng đang có lứa nuôi trong một ngày (mặc định hôm nay). */
    public List<BarnDayPlan> farm(LocalDate date, boolean canSeeFinance) {
        return farm(date, canSeeFinance, null);
    }

    /** workerEmail khác null: chỉ những chuồng công nhân đó phụ trách, và chỉ việc được giao cho họ. */
    public List<BarnDayPlan> farm(LocalDate date, boolean canSeeFinance, String workerEmail) {
        LocalDate day = date == null ? today() : date;
        if (day.isAfter(today())) throw new BadRequestException("Chỉ xem được phiếu việc đến hôm nay.", "DAILY_PLAN_FUTURE");
        Set<Long> barns = workerEmail == null ? null : workAssignment.barnIdsOf(workerEmail);
        return cycleRepository.findAllByStatus(CycleStatus.ACTIVE).stream()
                .filter(cycle -> !day.isBefore(cycle.getStartDate()))
                .filter(cycle -> barns == null || barns.contains(cycle.getBarn().getId()))
                .sorted(Comparator.comparing((FarmingCycle cycle) -> cycle.getBarn().getArea().getName())
                        .thenComparing(cycle -> cycle.getBarn().getName()))
                .map(cycle -> response(cycle, day, compute(cycle, day), canSeeFinance, workerEmail))
                .filter(plan -> !plan.flocks().isEmpty() || !plan.tasks().isEmpty() || !plan.assignedTasks().isEmpty())
                .toList();
    }

    public BarnDayPlan barn(Long cycleId, LocalDate date, boolean canSeeFinance) {
        return barn(cycleId, date, canSeeFinance, null);
    }

    public BarnDayPlan barn(Long cycleId, LocalDate date, boolean canSeeFinance, String workerEmail) {
        FarmingCycle cycle = cycleService.find(cycleId);
        LocalDate day = date == null ? (cycle.getEndDate() != null ? cycle.getEndDate() : today()) : date;
        LocalDate last = cycle.getEndDate() != null ? cycle.getEndDate() : today();
        if (day.isBefore(cycle.getStartDate()) || day.isAfter(last)) {
            throw new BadRequestException("Ngày xem phiếu việc phải từ " + format(cycle.getStartDate()) + " đến " + format(last) + ".", "CYCLE_DATE_OUT_OF_RANGE");
        }
        return response(cycle, day, compute(cycle, day), canSeeFinance, workerEmail);
    }

    /** Lứa nuôi thuộc chuồng nào (để kiểm tra công nhân có phụ trách chuồng không). */
    public Long barnIdOf(Long cycleId) {
        return cycleService.find(cycleId).getBarn().getId();
    }

    /**
     * Xác nhận một việc đã làm. Để trống lượng thực tế là làm đúng kế hoạch. Cám, thuốc, vắc-xin có hàng hóa thì trừ kho
     * (vắc-xin làm tròn lên cả lọ) và ghi chi phí: cám vào nhật ký cám, thuốc / vắc-xin vào khoản chi "Thuốc & vắc-xin".
     */
    @Transactional
    public BarnDayPlan confirm(Long cycleId, DailyTaskConfirmRequest request, String user, boolean canSeeFinance) {
        return confirm(cycleId, request, user, canSeeFinance, null);
    }

    @Transactional
    public BarnDayPlan confirm(Long cycleId, DailyTaskConfirmRequest request, String user, boolean canSeeFinance, String workerEmail) {
        FarmingCycle cycle = cycleService.requireActive(cycleId);
        LocalDate day = request.date();
        checkDate(cycle, day, "Ngày làm việc");
        if (logRepository.existsByCycleIdAndTaskDateAndTaskKey(cycleId, day, request.taskKey())) {
            throw new ConflictException("Việc này đã được xác nhận.", "DAILY_TASK_ALREADY_DONE", null);
        }
        Planned task = compute(cycle, day).tasks().stream().filter(item -> item.key.equals(request.taskKey())).findFirst()
                .orElseThrow(() -> new BadRequestException("Việc không có trong phiếu việc ngày " + format(day) + ".", "DAILY_TASK_NOT_FOUND"));

        boolean measured = task.category == ProgramStepCategory.FEED || task.category == ProgramStepCategory.MEDICINE
                || task.category == ProgramStepCategory.VACCINE;
        BigDecimal actual = !measured ? null : request.actualQuantity() != null ? request.actualQuantity().setScale(3, RoundingMode.HALF_UP) : task.total;
        if (measured && actual == null) {
            throw new BadRequestException("Chưa tính được lượng theo kế hoạch cho " + task.name + ". Hãy nhập lượng thực tế.", "DAILY_TASK_QUANTITY_REQUIRED");
        }
        String note = clean(request.note());
        boolean deviated = deviated(task, actual);
        if (deviated && note.isEmpty()) {
            throw new BadRequestException("Lượng thực tế lệch " + percent(task.total, actual) + " so với kế hoạch (" + amount(task.total) + " "
                    + task.unit.label() + "). Vui lòng ghi lý do.", "DAILY_TASK_NOTE_REQUIRED");
        }

        DailyTaskLog log = new DailyTaskLog();
        log.setCycle(cycle);
        log.setTaskDate(day);
        log.setTaskKey(task.key);
        log.setCategory(task.category);
        log.setTaskName(task.name);
        log.setMeal(task.meal);
        log.setPlannedQuantity(task.total);
        log.setActualQuantity(actual);
        log.setUsageUnit(task.unit);
        log.setDeviated(deviated);
        log.setNote(note);
        log.setDoneBy(user);
        log.setDoneAt(LocalDateTime.now());

        BigDecimal cost = BigDecimal.ZERO;
        if (task.item != null && actual != null && actual.signum() > 0) {
            InventoryItem item = task.item;
            BigDecimal packs = UsageMath.toStock(actual, task.unit, item, task.category == ProgramStepCategory.VACCINE);
            boolean taken = inventoryRepository.takeStock(item.getId(), packs) == 1;
            entityManager.refresh(item);
            if (!taken) {
                throw new BadRequestException("Kho chỉ còn " + amount(item.getStock()) + " " + stockUnit(item) + " " + item.getProduct().getName()
                        + ", cần " + amount(packs) + ". Hãy nhập kho trước khi xác nhận.", "STOCK_NOT_ENOUGH");
            }
            cost = packs.multiply(item.getPrice()).setScale(0, RoundingMode.HALF_UP);
            log.setInventoryItem(item);
            log.setStockQuantity(packs);
            log.setUnitPrice(item.getPrice());
            log.setCost(cost);
        }
        String source = "Việc hôm nay" + (task.meal != null ? " · cữ " + task.meal + "/" + task.meals : "") + (note.isEmpty() ? "" : " · " + note);
        if (task.category == ProgramStepCategory.FEED && actual.signum() > 0) {
            FeedRecord record = new FeedRecord();
            record.setCycle(cycle);
            record.setRecordDate(day);
            record.setFeedName(task.item != null ? task.item.getProduct().getName() : task.name);
            record.setQuantityKg(actual);
            record.setUnitPrice(task.item != null ? UsageMath.pricePerKg(log.getInventoryItem()) : BigDecimal.ZERO);
            record.setNote(source);
            record.setCreatedBy(user);
            log.setFeedRecord(feedRepository.save(record));
        } else if (cost.signum() > 0) {
            CycleExpense expense = new CycleExpense();
            expense.setCycle(cycle);
            expense.setExpenseDate(day);
            expense.setCategory(ExpenseCategory.MEDICINE);
            expense.setAmount(cost);
            expense.setNote(task.name + " · " + amount(actual) + " " + task.unit.label() + " · " + source);
            expense.setCreatedBy(user);
            log.setExpense(expenseRepository.save(expense));
        }
        logRepository.saveAndFlush(log);
        return response(cycle, day, compute(cycle, day), canSeeFinance, workerEmail);
    }

    /** Hoàn tác xác nhận nhầm: hoàn lại tồn kho, xóa nhật ký cám / khoản chi đã sinh ra. Công nhân chỉ hoàn tác việc của mình trong hôm nay. */
    @Transactional
    public BarnDayPlan undo(Long cycleId, LocalDate date, String taskKey, String user, boolean owner, boolean canSeeFinance) {
        return undo(cycleId, date, taskKey, user, owner, canSeeFinance, null);
    }

    @Transactional
    public BarnDayPlan undo(Long cycleId, LocalDate date, String taskKey, String user, boolean owner, boolean canSeeFinance, String workerEmail) {
        FarmingCycle cycle = cycleService.requireActive(cycleId);
        DailyTaskLog log = logRepository.findByCycleIdAndTaskDateAndTaskKey(cycleId, date, taskKey)
                .orElseThrow(() -> new ResourceNotFoundException("Việc này chưa được xác nhận."));
        if (!owner && (!log.getDoneBy().equalsIgnoreCase(user) || !date.equals(today()))) {
            throw new ConflictException("Công nhân chỉ hoàn tác được việc do mình xác nhận trong hôm nay.", "DAILY_TASK_UNDO_FORBIDDEN", null);
        }
        if (log.getInventoryItem() != null && log.getStockQuantity() != null) {
            inventoryRepository.returnStock(log.getInventoryItem().getId(), log.getStockQuantity());
            entityManager.refresh(log.getInventoryItem());
        }
        FeedRecord record = log.getFeedRecord();
        CycleExpense expense = log.getExpense();
        logRepository.delete(log);
        logRepository.flush();
        if (record != null) feedRepository.delete(record);
        if (expense != null) expenseRepository.delete(expense);
        return response(cycle, date, compute(cycle, date), canSeeFinance, workerEmail);
    }

    // ---------------------------------------------------------------- plan

    private record FlockDay(Flock flock, int age, int heads) { }

    private record Plan(List<FlockDay> flocks, List<Planned> tasks, List<String> warnings) { }

    /** Một việc theo kế hoạch, gộp cho cả chuồng. shares: lượng của từng đàn; total null khi chưa tính được. */
    private static final class Planned {
        String key;
        String groupKey;
        ProgramStepCategory category;
        String name;
        Integer meal;
        Integer meals;
        AdministrationMethod method;
        UsageUnit unit;
        InventoryItem item;
        /** Hàng hóa đã gắn nhưng chưa có quy cách đơn vị (không quy đổi được nên chưa trừ kho). */
        String itemWithoutContent;
        BigDecimal tempMin;
        BigDecimal tempMax;
        String note;
        BigDecimal total;
        /** Có đàn chưa tính được lượng (thiếu định mức, đơn vị liều chưa rõ, thuốc theo cám nhưng không có cám). */
        boolean unknown;
        final Set<BigDecimal> doses = new TreeSet<>();
        String doseUnit;
        /** Lượng của từng đàn, theo id đàn. */
        final Map<Long, BigDecimal> shares = new LinkedHashMap<>();
    }

    private Plan compute(FarmingCycle cycle, LocalDate day) {
        List<Flock> flocks = flockRepository.findAllByCycleIdOrderByImportDateAscIdAsc(cycle.getId());
        List<FlockMovement> movements = movementRepository.findAllByFlock_Cycle_IdOrderByMovementDateAscIdAsc(cycle.getId());
        List<String> warnings = new ArrayList<>();
        List<FlockDay> present = new ArrayList<>();
        for (Flock flock : flocks) {
            if (flock.getImportDate().isAfter(day)) continue;
            int heads = headsAtEndOf(flock, day, movements);
            if (heads <= 0) continue;
            present.add(new FlockDay(flock, ageOn(flock, day), heads));
            if (flock.getProgram() == null) {
                warnings.add("Đàn " + flockCode(flock) + " chưa gắn chương trình nuôi nên chưa có việc.");
            }
        }

        Map<String, Planned> groups = new LinkedHashMap<>();
        for (FlockDay flockDay : present) {
            FarmingProgram program = flockDay.flock().getProgram();
            if (program == null) continue;
            // Công việc (WORK) không thuộc chương trình nuôi nữa; bỏ qua nếu còn sót trong dữ liệu cũ.
            List<FarmingProgramStep> steps = program.getSteps().stream()
                    .filter(step -> step.getCategory() != ProgramStepCategory.WORK)
                    .filter(step -> flockDay.age() >= step.getDayFrom() && flockDay.age() <= step.getDayTo()).toList();
            BigDecimal feedKg = steps.stream().filter(step -> step.getCategory() == ProgramStepCategory.FEED && step.getQuantity() != null)
                    .map(step -> grams(step.getQuantity(), flockDay.heads()).divide(BigDecimal.valueOf(1000), 3, RoundingMode.HALF_UP))
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            for (FarmingProgramStep step : steps) {
                String groupKey = step.getCategory().name() + ":" + identity(step);
                Planned group = groups.computeIfAbsent(groupKey, key -> newGroup(key, step));
                if (step.getMealsPerDay() != null) group.meals = Math.max(group.meals == null ? 1 : group.meals, step.getMealsPerDay());
                if (step.getQuantity() != null) group.doses.add(step.getQuantity().stripTrailingZeros());
                BigDecimal share = share(step, flockDay, feedKg);
                if (share == null) group.unknown = true;
                group.shares.merge(flockDay.flock().getId(), share == null ? BigDecimal.ZERO : share, BigDecimal::add);
            }
        }

        List<Planned> tasks = new ArrayList<>();
        for (Planned group : groups.values()) {
            boolean measured = group.category == ProgramStepCategory.FEED || group.category == ProgramStepCategory.MEDICINE
                    || group.category == ProgramStepCategory.VACCINE;
            if (measured && (group.unknown || group.unit == null)) {
                group.unknown = true;
                warnings.add(label(group.category) + " \"" + group.name + "\": chưa tính được lượng vì thiếu liều, đơn vị liều chưa rõ hoặc không có cám để trộn.");
            } else if (measured && group.item == null && group.itemWithoutContent != null) {
                warnings.add("Hàng hóa " + group.itemWithoutContent + " chưa có quy cách đơn vị (ví dụ Bao 25kg = 25 kg) nên chưa trừ kho và chưa tính tiền.");
            } else if (measured && group.item == null) {
                warnings.add(label(group.category) + " \"" + group.name + "\" chưa gắn hàng hóa kho nên chưa trừ kho và chưa tính tiền.");
            }
            if (group.category == ProgramStepCategory.FEED) {
                int meals = group.meals == null ? 1 : group.meals;
                // Mỗi cữ = lượng cả ngày của chuồng / số cữ (không cộng các phần đã làm tròn của từng đàn).
                BigDecimal perMeal = group.unknown ? null : group.shares.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add)
                        .divide(BigDecimal.valueOf(meals), 3, RoundingMode.HALF_UP);
                for (int meal = 1; meal <= meals; meal++) {
                    Planned task = copy(group);
                    task.key = group.groupKey + ":M" + meal;
                    task.meal = meal;
                    task.meals = meals;
                    group.shares.forEach((flockId, value) -> task.shares.put(flockId, value.divide(BigDecimal.valueOf(meals), 3, RoundingMode.HALF_UP)));
                    task.total = perMeal;
                    tasks.add(task);
                }
            } else {
                Planned task = copy(group);
                task.key = group.groupKey;
                group.shares.forEach(task.shares::put);
                tasks.add(task);
            }
        }
        for (Planned task : tasks) {
            boolean measured = task.category == ProgramStepCategory.FEED || task.category == ProgramStepCategory.MEDICINE
                    || task.category == ProgramStepCategory.VACCINE;
            if (task.category == ProgramStepCategory.FEED && task.unit != null) continue;
            task.total = !measured || task.unknown || task.unit == null ? null
                    : task.shares.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add).setScale(3, RoundingMode.HALF_UP);
        }
        tasks.sort(Comparator.comparing((Planned task) -> ORDER.indexOf(task.category))
                .thenComparing(task -> task.meal == null ? 0 : task.meal).thenComparing(task -> task.name));
        return new Plan(present, tasks, warnings);
    }

    /** Số con của đàn cuối ngày: tồn hiện tại cộng lại những gì ra khỏi đàn sau ngày đó, trừ những gì vào sau ngày đó. */
    private static int headsAtEndOf(Flock flock, LocalDate day, List<FlockMovement> movements) {
        int heads = flock.getQuantity();
        for (FlockMovement movement : movements) {
            if (!movement.getFlock().getId().equals(flock.getId()) || !movement.getMovementDate().isAfter(day)) continue;
            switch (movement.getType()) {
                case IMPORT, TRANSFER_IN -> heads -= movement.getQuantity();
                case DEATH, CULL, HARVEST, TRANSFER_OUT -> heads += movement.getQuantity();
            }
        }
        return heads;
    }

    /** Lượng của một đàn cho một nội dung theo đơn vị hiển thị (kg cám, g / ml thuốc, liều vắc-xin); null nếu chưa tính được. */
    private static BigDecimal share(FarmingProgramStep step, FlockDay flockDay, BigDecimal feedKg) {
        if (step.getQuantity() == null) return null;
        switch (step.getCategory()) {
            case FEED:
                return grams(step.getQuantity(), flockDay.heads()).divide(BigDecimal.valueOf(1000), 3, RoundingMode.HALF_UP);
            case MEDICINE, VACCINE: {
                UsageMath.Basis basis = UsageMath.basis(step.getCategory(), step.getUnit());
                if (basis == null || UsageMath.usageUnit(step.getCategory(), step.getUnit()) == null) return null;
                BigDecimal base = switch (basis) {
                    case PER_HEAD -> BigDecimal.valueOf(flockDay.heads());
                    case PER_FEED_KG -> feedKg;
                    case PER_WATER_LITER -> feedKg.multiply(UsageMath.WATER_LITERS_PER_FEED_KG);
                };
                if (base.signum() == 0 && basis != UsageMath.Basis.PER_HEAD) return null;
                return step.getQuantity().multiply(base).setScale(3, RoundingMode.HALF_UP);
            }
            default:
                return BigDecimal.ZERO;
        }
    }

    private static BigDecimal grams(BigDecimal perHead, int heads) { return perHead.multiply(BigDecimal.valueOf(heads)); }

    /** Việc cùng hàng hóa (hoặc cùng tên khi chưa gắn hàng hóa) của các đàn được gộp làm một. */
    private static String identity(FarmingProgramStep step) {
        if (step.getInventoryItem() != null && step.getCategory() != ProgramStepCategory.TEMPERATURE && step.getCategory() != ProgramStepCategory.WORK) {
            return "I" + step.getInventoryItem().getId();
        }
        String name = step.getName().strip().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
        return "N" + (name.length() > 90 ? name.substring(0, 90) : name);
    }

    private static Planned newGroup(String key, FarmingProgramStep step) {
        Planned group = new Planned();
        group.groupKey = key;
        group.category = step.getCategory();
        group.name = step.getInventoryItem() != null ? step.getInventoryItem().getProduct().getName() : step.getName();
        group.method = step.getMethod();
        group.unit = UsageMath.displayUnit(step.getCategory(), step.getUnit());
        group.item = step.getInventoryItem() != null && UsageMath.compatible(step.getInventoryItem(),
                UsageMath.usageUnit(step.getCategory(), step.getUnit())) ? step.getInventoryItem() : null;
        if (step.getInventoryItem() != null && group.item == null) group.itemWithoutContent = step.getInventoryItem().getProduct().getName();
        group.tempMin = step.getTempMin();
        group.tempMax = step.getTempMax();
        group.note = step.getNote();
        group.doseUnit = step.getUnit();
        if (step.getInventoryItem() != null && !step.getName().equalsIgnoreCase(group.name)) {
            group.note = (step.getName() + (step.getNote() == null || step.getNote().isBlank() ? "" : " · " + step.getNote()));
        }
        return group;
    }

    private static Planned copy(Planned group) {
        Planned task = new Planned();
        task.groupKey = group.groupKey;
        task.category = group.category;
        task.name = group.name;
        task.meals = group.meals;
        task.method = group.method;
        task.unit = group.unit;
        task.item = group.item;
        task.unknown = group.unknown;
        task.tempMin = group.tempMin;
        task.tempMax = group.tempMax;
        task.note = group.note;
        task.doses.addAll(group.doses);
        task.doseUnit = group.doseUnit;
        return task;
    }

    private static boolean deviated(Planned task, BigDecimal actual) {
        if (task.total == null || actual == null) return false;
        if (task.total.signum() == 0) return actual.signum() != 0;
        BigDecimal limit = task.category == ProgramStepCategory.FEED ? FEED_TOLERANCE : DOSE_TOLERANCE;
        BigDecimal ratio = actual.subtract(task.total).abs().divide(task.total, 4, RoundingMode.HALF_UP);
        return ratio.compareTo(limit) > 0;
    }

    // ---------------------------------------------------------------- response

    private BarnDayPlan response(FarmingCycle cycle, LocalDate day, Plan plan, boolean canSeeFinance, String workerEmail) {
        Barn barn = cycle.getBarn();
        Map<Long, FlockDay> flocks = new LinkedHashMap<>();
        for (FlockDay flockDay : plan.flocks()) flocks.put(flockDay.flock().getId(), flockDay);
        Map<String, DailyTaskLog> logs = new LinkedHashMap<>();
        for (DailyTaskLog log : logRepository.findAllByCycleIdAndTaskDate(cycle.getId(), day)) logs.put(log.getTaskKey(), log);

        List<String> warnings = new ArrayList<>(plan.warnings());
        Map<Long, BigDecimal> remainingByItem = new LinkedHashMap<>();
        Map<Long, InventoryItem> items = new LinkedHashMap<>();
        List<BarnDayPlan.Task> tasks = new ArrayList<>();
        for (Planned task : plan.tasks()) {
            DailyTaskLog log = logs.remove(task.key);
            BigDecimal stock = task.item != null && task.total != null
                    ? UsageMath.toStock(task.total, task.unit, task.item, task.category == ProgramStepCategory.VACCINE) : null;
            if (log == null && stock != null) {
                remainingByItem.merge(task.item.getId(), stock, BigDecimal::add);
                items.put(task.item.getId(), task.item);
            }
            tasks.add(new BarnDayPlan.Task(task.key, task.category, task.name, task.meal, task.meals, task.method, doseText(task),
                    task.total, task.unit == null ? null : task.unit.label(), stock, task.item == null ? null : stockUnit(task.item),
                    task.item == null ? null : task.item.getId(), task.item == null ? null : task.item.getProduct().getName(),
                    task.item == null ? null : task.item.getStock(),
                    task.item == null || stock == null || log != null ? null : task.item.getStock().compareTo(stock) >= 0,
                    task.tempMin, task.tempMax, task.note,
                    task.shares.entrySet().stream().map(entry -> {
                        FlockDay flockDay = flocks.get(entry.getKey());
                        return new BarnDayPlan.Share(entry.getKey(), flockCode(flockDay.flock()), flockDay.age(), flockDay.heads(),
                                task.unknown ? null : entry.getValue());
                    }).toList(),
                    log == null ? null : done(log, canSeeFinance)));
        }
        // Việc đã xác nhận nhưng không còn trong kế hoạch (đổi chương trình, đàn đã bán hết...) vẫn hiện để xem và hoàn tác.
        for (DailyTaskLog log : logs.values()) {
            tasks.add(new BarnDayPlan.Task(log.getTaskKey(), log.getCategory(), log.getTaskName(), log.getMeal(), null, null, null,
                    log.getPlannedQuantity(), log.getUsageUnit() == null ? null : log.getUsageUnit().label(), null,
                    log.getInventoryItem() == null ? null : stockUnit(log.getInventoryItem()),
                    log.getInventoryItem() == null ? null : log.getInventoryItem().getId(),
                    log.getInventoryItem() == null ? null : log.getInventoryItem().getProduct().getName(), null, null, null, null,
                    "Không còn trong kế hoạch hiện tại.", List.of(), done(log, canSeeFinance)));
        }
        remainingByItem.forEach((id, need) -> {
            InventoryItem item = items.get(id);
            if (item.getStock().compareTo(need) < 0) {
                warnings.add("Kho chỉ còn " + amount(item.getStock()) + " " + stockUnit(item) + " " + item.getProduct().getName()
                        + ", các việc còn lại trong ngày cần " + amount(need) + ".");
            }
        });

        List<DailyTaskLog> all = logRepository.findAllByCycleIdAndTaskDate(cycle.getId(), day);
        BigDecimal cost = canSeeFinance ? all.stream().map(DailyTaskLog::getCost).filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add).setScale(0, RoundingMode.HALF_UP) : null;
        return new BarnDayPlan(cycle.getId(), cycleCode(cycle), barn.getId(), barn.getName(), barn.getArea().getName(), day,
                plan.flocks().stream().mapToInt(FlockDay::heads).sum(),
                plan.flocks().stream().map(f -> new BarnDayPlan.FlockLine(f.flock().getId(), flockCode(f.flock()), f.flock().getName(),
                        f.flock().getProgram() == null ? null : f.flock().getProgram().getName(), f.age(), f.heads())).toList(),
                tasks, all.size(), cost, warnings, workAssignment.workersOf(barn.getId()),
                workAssignment.tasksOf(barn.getId(), day, workerEmail));
    }

    private static BarnDayPlan.Done done(DailyTaskLog log, boolean canSeeFinance) {
        return new BarnDayPlan.Done(log.getId(), log.getActualQuantity(), log.getStockQuantity(),
                canSeeFinance ? log.getUnitPrice() : null, canSeeFinance ? log.getCost() : null, log.isDeviated(), log.getNote(),
                log.getDoneBy(), log.getDoneAt());
    }

    /** Định mức cho 1 con hiển thị trên phiếu, ví dụ "85 g/con/ngày" hoặc "80–85 g/con/ngày" khi các đàn khác mức. */
    private static String doseText(Planned task) {
        if (task.doses.isEmpty() || task.doseUnit == null || task.doseUnit.isBlank()) return null;
        List<BigDecimal> doses = new ArrayList<>(task.doses);
        String low = amount(doses.get(0)), high = amount(doses.get(doses.size() - 1));
        return (low.equals(high) ? low : low + "–" + high) + " " + task.doseUnit;
    }

    private static String stockUnit(InventoryItem item) {
        return item.getUnit() == null ? "" : item.getUnit().getName();
    }

    private static String label(ProgramStepCategory category) {
        return switch (category) {
            case FEED -> "Cám";
            case MEDICINE -> "Thuốc";
            case VACCINE -> "Vắc-xin";
            case TEMPERATURE -> "Nhiệt độ";
            case WORK -> "Công việc";
        };
    }

    private static String percent(BigDecimal planned, BigDecimal actual) {
        if (planned == null || planned.signum() == 0) return "so với 0";
        BigDecimal pct = actual.subtract(planned).multiply(BigDecimal.valueOf(100)).divide(planned, 1, RoundingMode.HALF_UP);
        return (pct.signum() > 0 ? "+" : "") + pct.stripTrailingZeros().toPlainString().replace('.', ',') + "%";
    }

    /** Số kiểu Việt Nam: 1.650,7 */
    static String amount(BigDecimal value) {
        if (value == null) return "";
        java.text.DecimalFormat format = new java.text.DecimalFormat("#,##0.###", java.text.DecimalFormatSymbols.getInstance(Locale.forLanguageTag("vi-VN")));
        return format.format(value);
    }
}
