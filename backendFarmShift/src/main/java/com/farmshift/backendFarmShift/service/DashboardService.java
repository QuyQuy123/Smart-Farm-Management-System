package com.farmshift.backendFarmShift.service;

import com.farmshift.backendFarmShift.dto.response.BarnDayPlan;
import com.farmshift.backendFarmShift.dto.response.CycleDetailResponse;
import com.farmshift.backendFarmShift.dto.response.CycleFinance;
import com.farmshift.backendFarmShift.dto.response.DashboardResponse;
import com.farmshift.backendFarmShift.dto.response.DashboardResponse.*;
import com.farmshift.backendFarmShift.dto.response.FarmingProgramResponse;
import com.farmshift.backendFarmShift.dto.response.CycleRecordResponse;
import com.farmshift.backendFarmShift.dto.response.FlockMovementResponse;
import com.farmshift.backendFarmShift.dto.response.FlockResponse;
import com.farmshift.backendFarmShift.dto.response.ProgramStepResponse;
import com.farmshift.backendFarmShift.dto.response.WorkBoard;
import com.farmshift.backendFarmShift.entity.FlockMovementType;
import com.farmshift.backendFarmShift.entity.ProgramStepCategory;
import com.farmshift.backendFarmShift.repository.PurchaseInvoiceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.NumberFormat;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.function.Function;

/**
 * Bảng tin trong ngày: tổng hợp phiếu việc, chỉ số lứa, chương trình nuôi và công nợ thành vài con số, danh sách việc cần xử lý,
 * thẻ từng chuồng và lịch 7 ngày tới. Dữ liệu lấy lại từ DailyPlanService / CycleService nên phân quyền giống các trang đó.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DashboardService {
    /** Hao hụt trong ngày từ ngưỡng này (% số con trong chuồng) thì báo đỏ. */
    static final BigDecimal DANGER_LOSS_RATE = new BigDecimal("0.5");
    static final int UPCOMING_DAYS = 7;
    static final int HISTORY_DAYS = 7;
    private static final List<ProgramStepCategory> UPCOMING_KINDS = List.of(ProgramStepCategory.VACCINE, ProgramStepCategory.MEDICINE,
            ProgramStepCategory.FEED);
    private static final List<FlockMovementType> LOSSES = List.of(FlockMovementType.DEATH, FlockMovementType.CULL);

    private final DailyPlanService dailyPlanService;
    private final CycleService cycleService;
    private final PurchaseInvoiceRepository invoiceRepository;

    /** workerEmail khác null: chỉ các chuồng công nhân đó phụ trách. now: giờ hiện tại để tính việc quá giờ. */
    public DashboardResponse get(boolean canSeeFinance, String workerEmail, LocalTime now) {
        LocalDate today = CycleService.today();
        List<BarnDayPlan> plans = dailyPlanService.farm(today, canSeeFinance, workerEmail);
        List<Alert> alerts = new ArrayList<>();
        List<BarnCard> barns = new ArrayList<>();
        List<Upcoming> upcoming = new ArrayList<>();
        List<Growth> growth = new ArrayList<>();
        BigDecimal[] money = {BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO};
        int live = 0, lossToday = 0, loss7d = 0, tasksDone = 0, tasksTotal = 0, overdueTotal = 0;

        for (BarnDayPlan plan : plans) {
            CycleDetailResponse detail = cycleService.detail(plan.cycleId(), canSeeFinance);
            int quantity = detail.metrics().currentQuantity();
            int barnLossToday = losses(detail.movements(), today, today);
            int barnLoss7d = losses(detail.movements(), today.minusDays(6), today);
            List<String> overdue = new ArrayList<>();
            int done = 0;
            for (BarnDayPlan.Task task : plan.tasks()) {
                if (task.done() != null) done++;
                else if (task.time() != null && LocalTime.parse(task.time()).isBefore(now)) overdue.add(task.name());
            }
            for (WorkBoard.AssignedTask task : plan.assignedTasks()) {
                if (task.done() != null) done++;
                else if (task.dueTime() != null && task.dueTime().isBefore(now)) overdue.add(task.title());
            }
            int total = plan.tasks().size() + plan.assignedTasks().size();
            boolean noWorker = plan.workers() == null || plan.workers().isEmpty();
            boolean lossDanger = barnLossToday > 0 && rate(barnLossToday, quantity + barnLossToday).compareTo(DANGER_LOSS_RATE) >= 0;
            String status = lossDanger ? "DANGER" : !overdue.isEmpty() || !plan.warnings().isEmpty() || noWorker || barnLossToday > 0 ? "WARN" : "OK";

            if (barnLossToday > 0) {
                alerts.add(new Alert(lossDanger ? "DANGER" : "WARN", "LOSS", plan.barnName() + ": hao hụt " + barnLossToday + " con hôm nay",
                        "Tỷ lệ " + rate(barnLossToday, quantity + barnLossToday) + "% số con trong chuồng.", plan.barnId()));
            }
            if (!overdue.isEmpty()) {
                alerts.add(new Alert("WARN", "OVERDUE", plan.barnName() + ": " + overdue.size() + " việc quá giờ chưa làm", summary(overdue), plan.barnId()));
            }
            plan.warnings().forEach(warning -> alerts.add(new Alert("WARN", "STOCK", plan.barnName() + ": kho không đủ", warning, plan.barnId())));
            if (noWorker && workerEmail == null) {
                alerts.add(new Alert("INFO", "UNASSIGNED", plan.barnName() + " chưa có người phụ trách",
                        "Vào Việc hôm nay › Phân công để giao chuồng cho công nhân.", plan.barnId()));
            }

            upcoming.addAll(upcoming(detail.programs(), today, plan));
            growth.add(growth(detail, today, plan));
            barns.add(new BarnCard(plan.barnId(), plan.cycleId(), plan.barnName(), plan.areaName(), detail.metrics().ageDays(), quantity,
                    detail.metrics().avgWeightKg(), detail.metrics().fcr(), detail.metrics().lossRate(), barnLossToday, done, total, overdue.size(),
                    plan.workers() == null ? List.of() : plan.workers().stream().map(WorkBoard.WorkerRef::fullName).toList(), status,
                    detail.metrics().totalIn(), detail.metrics().deaths(), detail.metrics().culls()));

            CycleFinance finance = detail.finance();
            if (finance != null) {
                money[0] = money[0].add(nz(finance.chickCost()));
                money[1] = money[1].add(nz(finance.feedCost()));
                money[2] = money[2].add(nz(finance.totalCost()));
                money[3] = money[3].add(nz(finance.revenue()));
            }
            live += quantity;
            lossToday += barnLossToday;
            loss7d += barnLoss7d;
            tasksDone += done;
            tasksTotal += total;
            overdueTotal += overdue.size();
        }

        Long debt = null;
        Integer unpaid = null;
        if (canSeeFinance) {
            debt = invoiceRepository.sumOpenDebt();
            unpaid = (int) invoiceRepository.countOpenDebt();
            if (unpaid > 0) {
                alerts.add(new Alert("INFO", "DEBT", unpaid + " hóa đơn còn nợ nhà cung cấp",
                        "Tổng còn phải trả " + NumberFormat.getIntegerInstance(new Locale("vi", "VN")).format(debt) + "đ.", null));
            }
        }
        alerts.sort(Comparator.comparing((Alert alert) -> List.of("DANGER", "WARN", "INFO").indexOf(alert.level())));
        upcoming.sort(Comparator.comparing(Upcoming::date).thenComparing(Upcoming::barnName));
        Finance finance = canSeeFinance ? new Finance(money[0], money[1], money[2], money[3], money[3].subtract(money[2]),
                money[2].subtract(money[0]).subtract(money[1]).max(BigDecimal.ZERO)) : null;
        Kpis kpis = new Kpis(live, plans.size(), lossToday, loss7d, rate(loss7d, live + loss7d), tasksDone, tasksTotal, overdueTotal, debt, unpaid);
        List<DayTasks> history = new ArrayList<>(taskHistory(today, canSeeFinance, workerEmail));
        history.add(new DayTasks(today, tasksDone, tasksTotal, overdueTotal));
        return new DashboardResponse(today, kpis, alerts, barns, upcoming.stream().limit(15).toList(), finance, history, growth);
    }

    /** 6 ngày trước hôm nay: việc đã xong / tổng việc; việc không làm tính là "bỏ lỡ". */
    private List<DayTasks> taskHistory(LocalDate today, boolean canSeeFinance, String workerEmail) {
        List<DayTasks> days = new ArrayList<>();
        for (int back = HISTORY_DAYS - 1; back >= 1; back--) {
            LocalDate day = today.minusDays(back);
            int done = 0, total = 0;
            for (BarnDayPlan plan : dailyPlanService.farm(day, canSeeFinance, workerEmail)) {
                total += plan.tasks().size() + plan.assignedTasks().size();
                done += (int) plan.tasks().stream().filter(task -> task.done() != null).count()
                        + (int) plan.assignedTasks().stream().filter(task -> task.done() != null).count();
            }
            days.add(new DayTasks(day, done, total, total - done));
        }
        return days;
    }

    /** Cân TB lúc nhập đàn đầu tiên và các lần cân mẫu, đổi ngày cân ra ngày tuổi; mục tiêu = ngày kết thúc chương trình nuôi. */
    private static Growth growth(CycleDetailResponse detail, LocalDate today, BarnDayPlan plan) {
        Integer ageToday = detail.metrics().ageDays();
        List<WeightPoint> points = new ArrayList<>();
        detail.flocks().stream().min(Comparator.comparing(FlockResponse::importDate)).ifPresent(first ->
                points.add(new WeightPoint(first.ageAtImport(), first.importDate(), first.importAvgWeight())));
        if (ageToday != null) {
            detail.weightSamples().stream().filter(sample -> sample.quantity() != null).sorted(Comparator.comparing(CycleRecordResponse::date))
                    .forEach(sample -> points.add(new WeightPoint(ageToday - (int) ChronoUnit.DAYS.between(sample.date(), today), sample.date(), sample.quantity())));
        }
        points.sort(Comparator.comparingInt(WeightPoint::ageDays));
        FarmingProgramResponse program = detail.programs().isEmpty() ? null : detail.programs().get(0);
        BigDecimal target = program != null && program.targetWeightMax() != null ? program.targetWeightMax() : detail.barn().targetWeight();
        return new Growth(plan.barnId(), plan.barnName(), points, program == null ? null : program.durationDays(), target);
    }

    private static int losses(List<FlockMovementResponse> movements, LocalDate from, LocalDate to) {
        return movements.stream().filter(m -> LOSSES.contains(m.type()))
                .filter(m -> !m.movementDate().isBefore(from) && !m.movementDate().isAfter(to))
                .mapToInt(FlockMovementResponse::quantity).sum();
    }

    /** Mốc trong 7 ngày tới theo ngày tuổi: vắc-xin, thuốc, đổi cám bắt đầu, và ngày kết thúc chương trình (dự kiến xuất chuồng). */
    private static List<Upcoming> upcoming(List<FarmingProgramResponse> programs, LocalDate today, BarnDayPlan plan) {
        List<Upcoming> result = new ArrayList<>();
        for (FarmingProgramResponse program : programs) {
            Integer current = program.currentDay();
            if (current == null) continue;
            Function<Integer, LocalDate> dateOfDay = day -> today.plusDays(day - current);
            for (ProgramStepResponse step : program.steps()) {
                int inDays = step.dayFrom() - current;
                if (!UPCOMING_KINDS.contains(step.category()) || inDays < 1 || inDays > UPCOMING_DAYS) continue;
                String title = switch (step.category()) {
                    case VACCINE -> "Vắc-xin " + step.name();
                    case MEDICINE -> "Thuốc " + step.name();
                    default -> "Đổi cám: " + step.name();
                };
                result.add(new Upcoming(dateOfDay.apply(step.dayFrom()), inDays, plan.barnId(), plan.barnName(), step.category().name(),
                        title + " (ngày tuổi " + step.dayFrom() + ")"));
            }
            int toHarvest = program.durationDays() - current;
            if (toHarvest >= 0 && toHarvest <= UPCOMING_DAYS) {
                result.add(new Upcoming(today.plusDays(toHarvest), toHarvest, plan.barnId(), plan.barnName(), "HARVEST",
                        "Dự kiến xuất chuồng · " + program.name() + " " + program.durationDays() + " ngày"));
            }
        }
        return result;
    }

    /** "Higro 01 ×3, Rửa máng uống": gộp các cữ cùng tên để danh sách ngắn mà vẫn đủ việc. */
    private static String summary(List<String> names) {
        Map<String, Integer> counts = new LinkedHashMap<>();
        names.forEach(name -> counts.merge(name, 1, Integer::sum));
        return String.join(", ", counts.entrySet().stream().map(entry -> entry.getValue() > 1 ? entry.getKey() + " ×" + entry.getValue() : entry.getKey()).toList());
    }

    private static BigDecimal rate(int part, int total) {
        return total <= 0 ? BigDecimal.ZERO : BigDecimal.valueOf(part * 100L).divide(BigDecimal.valueOf(total), 2, RoundingMode.HALF_UP);
    }

    private static BigDecimal nz(BigDecimal value) { return value == null ? BigDecimal.ZERO : value; }
}
