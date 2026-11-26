package com.farmshift.backendFarmShift.service;

import com.farmshift.backendFarmShift.dto.response.ReportSummaryResponse;
import com.farmshift.backendFarmShift.dto.response.ReportSummaryResponse.*;
import com.farmshift.backendFarmShift.entity.*;
import com.farmshift.backendFarmShift.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.NumberFormat;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ReportService {
    private static final ZoneId VN_ZONE = ZoneId.of("Asia/Bangkok");
    private static final Locale VI_LOCALE = Locale.forLanguageTag("vi-VN");
    private static final LocalDate MIN_QUERY_DATE = LocalDate.of(1900, 1, 1);
    private static final LocalDate MAX_QUERY_DATE = LocalDate.of(2999, 12, 31);
    private static final int MAX_ACTIVITY_FEED = 1000;

    private final FarmingCycleRepository cycleRepository;
    private final FlockRepository flockRepository;
    private final FlockMovementRepository movementRepository;
    private final FeedRecordRepository feedRepository;
    private final WeightSampleRepository weightRepository;
    private final CycleExpenseRepository expenseRepository;
    private final CycleCarriedExpenseRepository carriedExpenseRepository;
    private final SalesOrderRepository salesOrderRepository;
    private final PurchaseInvoiceRepository purchaseInvoiceRepository;
    private final InventoryItemRepository inventoryRepository;
    private final InternalStockVoucherRepository internalVoucherRepository;
    private final DailyTaskLogRepository dailyTaskLogRepository;
    private final WorkTaskCheckRepository workTaskCheckRepository;
    private final AccountRepository accountRepository;
    private final WarehouseCategoryRepository warehouseRepository;

    public ReportSummaryResponse getSummary(LocalDate from, LocalDate to) {
        LocalDate today = LocalDate.now(VN_ZONE);
        boolean hasDateFilter = from != null || to != null;
        LocalDate rangeFrom = from != null ? from : MIN_QUERY_DATE;
        LocalDate rangeTo = to != null ? to : MAX_QUERY_DATE;

        Map<String, String> actorNameMap = buildActorNameMap();
        Map<Long, String> warehouseAreaMap = buildWarehouseAreaMap();

        List<FarmingCycle> allCycles = cycleRepository.findAllWithBarnAndAreaForReport();
        List<FarmingCycle> cyclesInRange = allCycles.stream()
                .filter(c -> overlapsRange(c.getStartDate(), c.getEndDate(), from, to))
                .sorted(Comparator
                        .comparing((FarmingCycle c) -> c.getStatus() == CycleStatus.ACTIVE ? 0 : 1)
                        .thenComparing(FarmingCycle::getStartDate, Comparator.nullsLast(Comparator.reverseOrder()))
                        .thenComparing(FarmingCycle::getId, Comparator.reverseOrder()))
                .toList();

        List<Long> cycleIds = cyclesInRange.stream().map(FarmingCycle::getId).toList();
        Map<Long, List<Flock>> flocksByCycle = cycleIds.isEmpty() ? Map.of()
                : groupFlocksByCycle(flockRepository.findByCycleIdInOrderByImportDateAscIdAsc(cycleIds));
        Map<Long, List<FlockMovement>> movementsByCycle = cycleIds.isEmpty() ? Map.of()
                : groupMovementsByCycle(movementRepository.findByFlock_Cycle_IdInOrderByMovementDateAscIdAsc(cycleIds));
        Map<Long, List<FeedRecord>> feedsByCycle = cycleIds.isEmpty() ? Map.of()
                : groupFeedsByCycle(feedRepository.findByCycleIdInOrderByRecordDateDescIdDesc(cycleIds));
        Map<Long, List<WeightSample>> weightsByCycle = cycleIds.isEmpty() ? Map.of()
                : groupWeightsByCycle(weightRepository.findByCycleIdInOrderBySampleDateDescIdDesc(cycleIds));
        Map<Long, List<CycleExpense>> expensesByCycle = cycleIds.isEmpty() ? Map.of()
                : groupExpensesByCycle(expenseRepository.findWithCycleByCycleIdIn(cycleIds));
        Map<Long, List<CycleCarriedExpense>> carriedByCycle = cycleIds.isEmpty() ? Map.of()
                : groupCarriedByCycle(carriedExpenseRepository.findWithCycleByCycleIdIn(cycleIds));

        // ── 1. Farm Summary & 6. Growth (FCR) ────────────────────────────────────────────────
        int sumIn = 0, sumHarvested = 0, sumDeaths = 0, sumCulls = 0, sumLive = 0, activeBarns = 0, closedCycles = 0;
        int sumSurvivalBase = 0;
        BigDecimal sumHarvestedWeight = BigDecimal.ZERO;
        BigDecimal sumCost = BigDecimal.ZERO, sumRevenue = BigDecimal.ZERO;
        BigDecimal sumChickCost = BigDecimal.ZERO, sumFeedCost = BigDecimal.ZERO, sumOtherCost = BigDecimal.ZERO;
        BigDecimal sumMedicineCost = BigDecimal.ZERO, sumOtherDirectCost = BigDecimal.ZERO;
        BigDecimal realizedProfit = BigDecimal.ZERO, wipCost = BigDecimal.ZERO, wipRevenue = BigDecimal.ZERO;

        List<BarnCycleRow> barnRows = new ArrayList<>();
        List<GrowthCycleRow> growthRows = new ArrayList<>();

        for (FarmingCycle cycle : cyclesInRange) {
            Long cycleId = cycle.getId();
            Barn barn = cycle.getBarn();
            String barnName = barn != null ? barn.getName() : "Trang trại";
            String areaName = barn != null && barn.getArea() != null ? barn.getArea().getName() : "";
            String cycleCode = CycleService.cycleCode(cycle);

            List<Flock> flocks = flocksByCycle.getOrDefault(cycleId, List.of());
            List<FlockMovement> movements = movementsByCycle.getOrDefault(cycleId, List.of());
            List<FeedRecord> feeds = feedsByCycle.getOrDefault(cycleId, List.of());
            List<WeightSample> samples = weightsByCycle.getOrDefault(cycleId, List.of());
            List<CycleExpense> expenses = expensesByCycle.getOrDefault(cycleId, List.of());
            List<CycleCarriedExpense> carriedExpenses = carriedByCycle.getOrDefault(cycleId, List.of());

            LocalDate cycleNaturalEnd = cycle.getEndDate() != null ? cycle.getEndDate() : today;
            LocalDate effectiveTo = (to != null && to.isBefore(cycleNaturalEnd)) ? to : cycleNaturalEnd;

            // Period flows inside [from, to] (equals full history when !hasDateFilter)
            int totalIn = 0, deaths = 0, culls = 0, harvested = 0, transferredOut = 0;
            BigDecimal harvestedWeight = BigDecimal.ZERO;
            BigDecimal chickCost = BigDecimal.ZERO, harvestRevenue = BigDecimal.ZERO;

            // Cumulative figures up to effectiveTo (closing headcount snapshot, FCR, ADG, cost/kg)
            int cumIn = 0, cumLoss = 0, cumHarvested = 0, futureQtyDelta = 0;
            BigDecimal cumInWeight = BigDecimal.ZERO, cumOutWeight = BigDecimal.ZERO, cumHarvestedWeight = BigDecimal.ZERO;
            BigDecimal cumChickCost = BigDecimal.ZERO;

            for (FlockMovement m : movements) {
                LocalDate mDate = m.getMovementDate();
                BigDecimal w = nz(m.getWeightKg());
                BigDecimal unitPrice = m.getFlock() != null && m.getFlock().getUnitPrice() != null
                        ? m.getFlock().getUnitPrice() : BigDecimal.ZERO;
                int qty = m.getQuantity();

                if (mDate != null && mDate.isAfter(effectiveTo)) {
                    switch (m.getType()) {
                        case IMPORT, TRANSFER_IN -> futureQtyDelta += qty;
                        case DEATH, CULL, HARVEST, TRANSFER_OUT -> futureQtyDelta -= qty;
                    }
                }

                if (isOnOrBefore(mDate, effectiveTo)) {
                    switch (m.getType()) {
                        case IMPORT, TRANSFER_IN -> {
                            cumIn += qty;
                            cumInWeight = cumInWeight.add(w);
                            cumChickCost = cumChickCost.add(unitPrice.multiply(BigDecimal.valueOf(qty)));
                        }
                        case DEATH -> cumLoss += qty;
                        case CULL -> {
                            cumLoss += qty;
                            cumOutWeight = cumOutWeight.add(w);
                        }
                        case HARVEST -> {
                            cumHarvested += qty;
                            cumOutWeight = cumOutWeight.add(w);
                            cumHarvestedWeight = cumHarvestedWeight.add(w);
                        }
                        case TRANSFER_OUT -> {
                            cumOutWeight = cumOutWeight.add(w);
                            cumChickCost = cumChickCost.subtract(unitPrice.multiply(BigDecimal.valueOf(qty)));
                        }
                    }
                }

                if (isInPeriod(mDate, rangeFrom, rangeTo, hasDateFilter)) {
                    switch (m.getType()) {
                        case IMPORT, TRANSFER_IN -> {
                            totalIn += qty;
                            chickCost = chickCost.add(unitPrice.multiply(BigDecimal.valueOf(qty)));
                        }
                        case DEATH -> deaths += qty;
                        case CULL -> culls += qty;
                        case HARVEST -> {
                            harvested += qty;
                            harvestedWeight = harvestedWeight.add(w);
                            if (m.getWeightKg() != null && m.getUnitPrice() != null) {
                                harvestRevenue = harvestRevenue.add(m.getWeightKg().multiply(m.getUnitPrice()));
                            }
                        }
                        case TRANSFER_OUT -> {
                            transferredOut += qty;
                            chickCost = chickCost.subtract(unitPrice.multiply(BigDecimal.valueOf(qty)));
                        }
                    }
                }
            }

            int liveNow = flocks.stream().mapToInt(Flock::getQuantity).sum();
            int currentQty = (to != null && to.isBefore(today))
                    ? Math.max(0, liveNow - futureQtyDelta)
                    : liveNow;
            LocalDate reference = effectiveTo;

            boolean includeCarriedPeriod = !hasDateFilter
                    || isInPeriod(cycle.getStartDate(), rangeFrom, rangeTo, true);
            boolean includeCarriedCum = isOnOrBefore(cycle.getStartDate(), effectiveTo);

            BigDecimal feedCost = includeCarriedPeriod ? nz(cycle.getCarriedFeedCost()) : BigDecimal.ZERO;
            BigDecimal cumFeedKg = includeCarriedCum ? nz(cycle.getCarriedFeedKg()) : BigDecimal.ZERO;
            BigDecimal cumFeedCost = includeCarriedCum ? nz(cycle.getCarriedFeedCost()) : BigDecimal.ZERO;

            for (FeedRecord f : feeds) {
                BigDecimal qtyKg = nz(f.getQuantityKg());
                BigDecimal lineCost = qtyKg.multiply(nz(f.getUnitPrice()));
                if (isOnOrBefore(f.getRecordDate(), effectiveTo)) {
                    cumFeedKg = cumFeedKg.add(qtyKg);
                    cumFeedCost = cumFeedCost.add(lineCost);
                }
                if (isInPeriod(f.getRecordDate(), rangeFrom, rangeTo, hasDateFilter)) {
                    feedCost = feedCost.add(lineCost);
                }
            }

            Map<ExpenseCategory, BigDecimal> expenseByCat = new EnumMap<>(ExpenseCategory.class);
            Map<ExpenseCategory, BigDecimal> cumExpenseByCat = new EnumMap<>(ExpenseCategory.class);
            for (CycleExpense e : expenses) {
                if (e.getCategory() == null) continue;
                BigDecimal amt = nz(e.getAmount());
                if (isOnOrBefore(e.getExpenseDate(), effectiveTo)) {
                    cumExpenseByCat.merge(e.getCategory(), amt, BigDecimal::add);
                }
                if (isInPeriod(e.getExpenseDate(), rangeFrom, rangeTo, hasDateFilter)) {
                    expenseByCat.merge(e.getCategory(), amt, BigDecimal::add);
                }
            }
            for (CycleCarriedExpense ce : carriedExpenses) {
                if (ce.getCategory() == null) continue;
                BigDecimal amt = nz(ce.getAmount());
                if (includeCarriedCum) {
                    cumExpenseByCat.merge(ce.getCategory(), amt, BigDecimal::add);
                }
                if (includeCarriedPeriod) {
                    expenseByCat.merge(ce.getCategory(), amt, BigDecimal::add);
                }
            }

            BigDecimal medicineCost = expenseByCat.getOrDefault(ExpenseCategory.MEDICINE, BigDecimal.ZERO);
            BigDecimal otherDirectCost = expenseByCat.entrySet().stream()
                    .filter(entry -> entry.getKey().countsInCycleCost() && entry.getKey() != ExpenseCategory.MEDICINE)
                    .map(Map.Entry::getValue)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            BigDecimal cumDirectExpenses = cumExpenseByCat.entrySet().stream()
                    .filter(entry -> entry.getKey().countsInCycleCost())
                    .map(Map.Entry::getValue)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            BigDecimal roundedChickCost = chickCost.max(BigDecimal.ZERO).setScale(0, RoundingMode.HALF_UP);
            BigDecimal roundedFeedCost = feedCost.setScale(0, RoundingMode.HALF_UP);
            BigDecimal roundedMedicineCost = medicineCost.setScale(0, RoundingMode.HALF_UP);
            BigDecimal roundedOtherDirectCost = otherDirectCost.setScale(0, RoundingMode.HALF_UP);
            BigDecimal roundedOtherCost = roundedMedicineCost.add(roundedOtherDirectCost);
            BigDecimal cycleTotalCost = roundedChickCost.add(roundedFeedCost).add(roundedOtherCost);
            BigDecimal cycleRevenue = harvestRevenue.setScale(0, RoundingMode.HALF_UP);
            BigDecimal cycleProfit = cycleRevenue.subtract(cycleTotalCost);

            BigDecimal cumTotalCost = cumChickCost.max(BigDecimal.ZERO).setScale(0, RoundingMode.HALF_UP)
                    .add(cumFeedCost.setScale(0, RoundingMode.HALF_UP))
                    .add(cumDirectExpenses.setScale(0, RoundingMode.HALF_UP));

            int lossCount = deaths + culls;
            int netPeriodChange = totalIn - deaths - culls - harvested - transferredOut;
            int openingQty = Math.max(0, currentQty - netPeriodChange);
            int survivalBase = hasDateFilter
                    ? Math.max(openingQty + totalIn, lossCount)
                    : totalIn;
            BigDecimal survivalRate = survivalBase > 0
                    ? BigDecimal.valueOf(survivalBase - lossCount).multiply(BigDecimal.valueOf(100))
                            .divide(BigDecimal.valueOf(survivalBase), 2, RoundingMode.HALF_UP)
                    : BigDecimal.valueOf(100);
            BigDecimal cumSurvivalRate = cumIn > 0
                    ? BigDecimal.valueOf(cumIn - cumLoss).multiply(BigDecimal.valueOf(100))
                            .divide(BigDecimal.valueOf(cumIn), 2, RoundingMode.HALF_UP)
                    : BigDecimal.valueOf(100);

            FarmingProgram program = flocks.stream()
                    .map(Flock::getProgram)
                    .filter(Objects::nonNull)
                    .findFirst()
                    .orElse(null);
            String breed = program != null && program.getBreed() != null && !program.getBreed().isBlank()
                    ? program.getBreed()
                    : flocks.stream().map(Flock::getName).filter(Objects::nonNull).findFirst().orElse("Gà thịt");

            // Growth / FCR calculation as of effectiveTo (shared between FarmSummary & GrowthReport)
            Integer ageDays = cycle.getHatchDate() != null
                    ? Integer.valueOf((int) ChronoUnit.DAYS.between(cycle.getHatchDate(), reference) + 1) // Integer: lứa chưa có đàn thì để null, không unbox
                    : flocks.isEmpty() ? null : CycleService.ageOn(flocks.get(0), reference);

            BigDecimal avgWeightKg = samples.stream()
                    .filter(s -> s.getSampleDate() != null && !s.getSampleDate().isAfter(reference))
                    .findFirst()
                    .map(WeightSample::getAvgWeightKg)
                    .orElse(cumHarvested > 0 && cumHarvestedWeight.signum() > 0
                            ? cumHarvestedWeight.divide(BigDecimal.valueOf(cumHarvested), 3, RoundingMode.HALF_UP)
                            : cumIn > 0 && cumInWeight.signum() > 0
                            ? cumInWeight.divide(BigDecimal.valueOf(cumIn), 3, RoundingMode.HALF_UP)
                            : null);

            BigDecimal rawBiomass = avgWeightKg == null ? BigDecimal.ZERO : avgWeightKg.multiply(BigDecimal.valueOf(currentQty));
            BigDecimal biomassKg = rawBiomass.setScale(1, RoundingMode.HALF_UP);
            BigDecimal carriedGainKg = includeCarriedCum ? nz(cycle.getCarriedGainKg()) : BigDecimal.ZERO;
            BigDecimal gainKg = rawBiomass.add(cumOutWeight).subtract(cumInWeight).add(carriedGainKg);
            BigDecimal fcr = gainKg.signum() > 0 && cumFeedKg.signum() > 0
                    ? cumFeedKg.divide(gainKg, 2, RoundingMode.HALF_UP) : null;

            BigDecimal roundedHarvestedWeight = harvestedWeight.setScale(1, RoundingMode.HALF_UP);
            BigDecimal producedKg = biomassKg.add(cumHarvestedWeight);
            BigDecimal costPerKg = producedKg.signum() > 0 && cumTotalCost.signum() > 0
                    ? cumTotalCost.divide(producedKg, 0, RoundingMode.HALF_UP) : null;

            boolean closedAsOfTo = cycle.getStatus() == CycleStatus.CLOSED
                    && (to == null || cycle.getEndDate() == null || !cycle.getEndDate().isAfter(to));

            barnRows.add(new BarnCycleRow(
                    cycleId, cycleCode, barn != null ? barn.getId() : null, barnName, areaName, breed,
                    cycle.getStatus() != null ? cycle.getStatus().name() : "ACTIVE",
                    cycle.getStartDate(), cycle.getEndDate(),
                    totalIn, deaths, culls, harvested, transferredOut, currentQty,
                    survivalRate, cycleTotalCost, cycleRevenue, cycleProfit,
                    roundedChickCost, roundedFeedCost, roundedOtherCost,
                    roundedMedicineCost, roundedOtherDirectCost, fcr, avgWeightKg,
                    roundedHarvestedWeight, biomassKg, costPerKg
            ));

            sumIn += totalIn;
            sumSurvivalBase += survivalBase;
            sumHarvested += harvested;
            sumHarvestedWeight = sumHarvestedWeight.add(harvestedWeight);
            sumDeaths += deaths;
            sumCulls += culls;
            sumLive += currentQty;
            if (!closedAsOfTo) {
                activeBarns++;
                wipCost = wipCost.add(cycleTotalCost);
                wipRevenue = wipRevenue.add(cycleRevenue);
            } else {
                closedCycles++;
                realizedProfit = realizedProfit.add(cycleProfit);
            }
            sumCost = sumCost.add(cycleTotalCost);
            sumRevenue = sumRevenue.add(cycleRevenue);
            sumChickCost = sumChickCost.add(roundedChickCost);
            sumFeedCost = sumFeedCost.add(roundedFeedCost);
            sumOtherCost = sumOtherCost.add(roundedOtherCost);
            sumMedicineCost = sumMedicineCost.add(roundedMedicineCost);
            sumOtherDirectCost = sumOtherDirectCost.add(roundedOtherDirectCost);

            int headBase = currentQty + cumHarvested;
            BigDecimal feedPerBirdKg = headBase > 0 && cumFeedKg.signum() > 0
                    ? cumFeedKg.divide(BigDecimal.valueOf(headBase), 2, RoundingMode.HALF_UP)
                    : (cumIn > 0 && cumFeedKg.signum() > 0 ? cumFeedKg.divide(BigDecimal.valueOf(cumIn), 2, RoundingMode.HALF_UP) : null);

            BigDecimal initialAvg = cumIn > 0 && cumInWeight.signum() > 0
                    ? cumInWeight.divide(BigDecimal.valueOf(cumIn), 3, RoundingMode.HALF_UP) : BigDecimal.ZERO;
            BigDecimal adgGrams = (ageDays != null && ageDays > 0 && avgWeightKg != null)
                    ? avgWeightKg.subtract(initialAvg).max(BigDecimal.ZERO)
                            .multiply(BigDecimal.valueOf(1000))
                            .divide(BigDecimal.valueOf(ageDays), 1, RoundingMode.HALF_UP)
                    : null;

            // Mục tiêu cân nặng thuộc chương trình nuôi, không đặt theo chuồng.
            BigDecimal targetWeightKg = program == null ? null
                    : program.getTargetWeightMax() != null ? program.getTargetWeightMax() : program.getTargetWeightMin();

            if (cumIn > 0 || cumFeedKg.signum() > 0) {
                growthRows.add(new GrowthCycleRow(
                        cycleId, cycleCode, barnName, areaName, breed,
                        cycle.getStatus() != null ? cycle.getStatus().name() : "ACTIVE",
                        ageDays, program != null ? program.getDurationDays() : null,
                        cumIn, currentQty, avgWeightKg, targetWeightKg,
                        cumFeedKg.setScale(1, RoundingMode.HALF_UP), feedPerBirdKg,
                        gainKg.setScale(1, RoundingMode.HALF_UP), fcr, adgGrams, cumSurvivalRate
                ));
            }
        }

        int totalLoss = sumDeaths + sumCulls;
        BigDecimal farmLossRate = sumSurvivalBase > 0
                ? BigDecimal.valueOf(totalLoss).multiply(BigDecimal.valueOf(100))
                        .divide(BigDecimal.valueOf(sumSurvivalBase), 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;
        BigDecimal farmSurvivalRate = sumSurvivalBase > 0
                ? BigDecimal.valueOf(100).subtract(farmLossRate).max(BigDecimal.ZERO) : BigDecimal.valueOf(100);

        FarmSummary farmSummary = new FarmSummary(
                sumIn, sumHarvested, sumHarvestedWeight.setScale(1, RoundingMode.HALF_UP),
                sumDeaths, sumCulls, sumLive, activeBarns, cyclesInRange.size(),
                farmLossRate, farmSurvivalRate,
                sumCost.setScale(0, RoundingMode.HALF_UP),
                sumRevenue.setScale(0, RoundingMode.HALF_UP),
                sumRevenue.subtract(sumCost).setScale(0, RoundingMode.HALF_UP),
                sumChickCost.setScale(0, RoundingMode.HALF_UP),
                sumFeedCost.setScale(0, RoundingMode.HALF_UP),
                sumOtherCost.setScale(0, RoundingMode.HALF_UP),
                sumMedicineCost.setScale(0, RoundingMode.HALF_UP),
                sumOtherDirectCost.setScale(0, RoundingMode.HALF_UP),
                barnRows,
                realizedProfit.setScale(0, RoundingMode.HALF_UP),
                wipCost.setScale(0, RoundingMode.HALF_UP),
                wipRevenue.setScale(0, RoundingMode.HALF_UP),
                closedCycles
        );

        List<BigDecimal> validFcrs = growthRows.stream().map(GrowthCycleRow::fcr).filter(Objects::nonNull).toList();
        BigDecimal avgFcr = validFcrs.isEmpty() ? null
                : validFcrs.stream().reduce(BigDecimal.ZERO, BigDecimal::add)
                        .divide(BigDecimal.valueOf(validFcrs.size()), 2, RoundingMode.HALF_UP);
        GrowthReport growthReport = new GrowthReport(growthRows.size(), avgFcr, growthRows);

        // ── 2. Sales Report ───────────────────────────────────────────────────────────────────
        List<SalesOrder> salesInRange = hasDateFilter
                ? salesOrderRepository.findInDateRangeForReport(rangeFrom, rangeTo)
                : salesOrderRepository.findAllWithCycleForReport();

        BigDecimal salesTotalRev = BigDecimal.ZERO, salesTotalPaid = BigDecimal.ZERO, salesTotalWeight = BigDecimal.ZERO;
        int salesTotalQty = 0;
        List<SalesOrderRow> salesRows = new ArrayList<>();
        for (SalesOrder o : salesInRange) {
            BigDecimal totalAmt = nz(o.getTotalAmount());
            BigDecimal paidAmt = nz(o.getPaidAmount());
            BigDecimal debtAmt = totalAmt.subtract(paidAmt).max(BigDecimal.ZERO);
            BigDecimal wt = nz(o.getTotalWeight());
            salesTotalRev = salesTotalRev.add(totalAmt);
            salesTotalPaid = salesTotalPaid.add(paidAmt);
            salesTotalWeight = salesTotalWeight.add(wt);
            salesTotalQty += o.getQuantity();
            FarmingCycle oCycle = o.getCycle();
            Barn oBarn = oCycle != null ? oCycle.getBarn() : null;
            String oBarnName = oBarn != null ? oBarn.getName() : "";
            String oAreaName = oBarn != null && oBarn.getArea() != null ? oBarn.getArea().getName() : "";
            salesRows.add(new SalesOrderRow(
                    o.getId(), o.getCode(), o.getDate(), o.getCustomer(), o.getFlock(),
                    o.getQuantity(), wt, nz(o.getUnitPrice()), totalAmt, paidAmt, debtAmt, o.getStatus(),
                    oCycle != null ? oCycle.getId() : null, oBarnName, oAreaName
            ));
        }
        BigDecimal salesAvgPrice = salesTotalWeight.signum() > 0
                ? salesTotalRev.divide(salesTotalWeight, 0, RoundingMode.HALF_UP) : BigDecimal.ZERO;
        SalesReport salesReport = new SalesReport(
                salesRows.size(),
                salesTotalRev.setScale(0, RoundingMode.HALF_UP),
                salesTotalPaid.setScale(0, RoundingMode.HALF_UP),
                salesTotalRev.subtract(salesTotalPaid).max(BigDecimal.ZERO).setScale(0, RoundingMode.HALF_UP),
                salesTotalWeight.setScale(1, RoundingMode.HALF_UP),
                salesTotalQty,
                salesAvgPrice,
                salesRows
        );

        // ── 3. Purchases Report ───────────────────────────────────────────────────────────────
        List<PurchaseInvoice> purchasesInRange = hasDateFilter
                ? purchaseInvoiceRepository.findInDateRangeForReport(rangeFrom, rangeTo)
                : purchaseInvoiceRepository.findAllWithDetailsForReport();

        long purTotal = 0L, purPaid = 0L, purDebt = 0L;
        int purValidCount = 0, purCancelledCount = 0;
        List<PurchaseRow> purchaseRows = new ArrayList<>();
        for (PurchaseInvoice p : purchasesInRange) {
            boolean cancelled = "Đã hủy".equalsIgnoreCase(p.getStockStatus());
            long total = p.getTotalAmount() != null ? p.getTotalAmount() : 0L;
            long paid = p.getPaidAmount() != null ? p.getPaidAmount() : 0L;
            long debt = Math.max(0L, total - paid);
            if (cancelled) {
                purCancelledCount++;
            } else {
                purValidCount++;
                purTotal += total;
                purPaid += paid;
                purDebt += debt;
            }
            String whSummary = summarizePurchaseTarget(p);
            String pBarnName = resolvePurchaseBarnName(p);
            String pAreaName = resolvePurchaseAreaName(p, warehouseAreaMap);
            purchaseRows.add(new PurchaseRow(
                    p.getId(), p.getCode(), p.getInvoiceDate(),
                    p.getSupplier() != null ? p.getSupplier().getName() : "—",
                    whSummary, total, paid, debt, p.getPaymentStatus(), p.getStockStatus(),
                    pBarnName, pAreaName
            ));
        }
        PurchasesReport purchasesReport = new PurchasesReport(purValidCount, purCancelledCount, purTotal, purPaid, purDebt, purchaseRows);

        // ── 4. Inventory Report (current stock snapshot) ──────────────────────────────────────
        List<InventoryItem> inventoryItems = inventoryRepository.findAllForReport();
        BigDecimal invTotalValue = BigDecimal.ZERO;
        List<InventoryRow> inventoryRows = new ArrayList<>();
        for (InventoryItem item : inventoryItems) {
            BigDecimal stock = nz(item.getStock());
            BigDecimal unitPrice = nz(item.getPrice());
            BigDecimal value = stock.multiply(unitPrice).setScale(0, RoundingMode.HALF_UP);
            invTotalValue = invTotalValue.add(value);
            WarehouseCategory wh = item.getWarehouse();
            String whAreaName = resolveWarehouseArea(wh, warehouseAreaMap);
            String whKind = wh != null && wh.getKind() != null ? wh.getKind() : "";
            inventoryRows.add(new InventoryRow(
                    item.getId(),
                    String.format(Locale.ROOT, "SP%05d", item.getId()),
                    item.getProduct() != null ? item.getProduct().getName() : "Hàng hóa",
                    wh != null ? wh.getName() : "Kho",
                    item.getProduct() != null ? item.getProduct().getProductType() : "",
                    item.getUnit() != null ? item.getUnit().getName() : "",
                    stock.setScale(2, RoundingMode.HALF_UP).stripTrailingZeros(),
                    unitPrice.setScale(0, RoundingMode.HALF_UP),
                    value,
                    whAreaName,
                    whKind
            ));
        }
        InventoryReport inventoryReport = new InventoryReport(
                inventoryRows.size(), invTotalValue, inventoryRows);

        // ── 5. Harvest Report ─────────────────────────────────────────────────────────────────
        List<FlockMovement> harvestMovementsInRange = hasDateFilter
                ? movementRepository.findHarvestInDateRangeForReport(rangeFrom, rangeTo)
                : movementsByCycle.values().stream()
                        .flatMap(List::stream)
                        .filter(m -> m.getType() == FlockMovementType.HARVEST)
                        .toList();

        Map<Long, HarvestAccumulator> harvestMap = new LinkedHashMap<>();
        for (FlockMovement m : harvestMovementsInRange) {
            if (m.getFlock() == null || m.getFlock().getCycle() == null) continue;
            FarmingCycle cycle = m.getFlock().getCycle();
            Barn barn = cycle.getBarn();
            String barnName = barn != null ? barn.getName() : "Trang trại";
            String areaName = barn != null && barn.getArea() != null ? barn.getArea().getName() : "";

            HarvestAccumulator acc = harvestMap.computeIfAbsent(cycle.getId(), k -> {
                List<Flock> cycleFlocks = flocksByCycle.getOrDefault(cycle.getId(), List.of());
                String breed = resolveCycleBreed(cycleFlocks, m.getFlock());
                return new HarvestAccumulator(cycle.getId(), CycleService.cycleCode(cycle), barnName, areaName, breed);
            });

            BigDecimal w = nz(m.getWeightKg());
            BigDecimal rev = (m.getWeightKg() != null && m.getUnitPrice() != null)
                    ? m.getWeightKg().multiply(m.getUnitPrice()) : BigDecimal.ZERO;
            acc.events++;
            acc.totalHead += m.getQuantity();
            acc.totalWeight = acc.totalWeight.add(w);
            acc.totalRevenue = acc.totalRevenue.add(rev);
            if (acc.lastDate == null || (m.getMovementDate() != null && m.getMovementDate().isAfter(acc.lastDate))) {
                acc.lastDate = m.getMovementDate();
            }
        }
        int totalHarvestEvents = 0, totalHarvestHeads = 0;
        BigDecimal totalHarvestKg = BigDecimal.ZERO, totalHarvestRev = BigDecimal.ZERO;
        List<HarvestCycleRow> harvestRows = new ArrayList<>();
        for (HarvestAccumulator acc : harvestMap.values()) {
            totalHarvestEvents += acc.events;
            totalHarvestHeads += acc.totalHead;
            totalHarvestKg = totalHarvestKg.add(acc.totalWeight);
            totalHarvestRev = totalHarvestRev.add(acc.totalRevenue);
            BigDecimal avgPerBird = acc.totalHead > 0
                    ? acc.totalWeight.divide(BigDecimal.valueOf(acc.totalHead), 2, RoundingMode.HALF_UP) : BigDecimal.ZERO;
            BigDecimal avgPrice = acc.totalWeight.signum() > 0
                    ? acc.totalRevenue.divide(acc.totalWeight, 0, RoundingMode.HALF_UP) : BigDecimal.ZERO;
            harvestRows.add(new HarvestCycleRow(
                    acc.cycleId, acc.cycleCode, acc.barnName, acc.areaName, acc.breed,
                    acc.events, acc.totalHead, acc.totalWeight.setScale(1, RoundingMode.HALF_UP),
                    avgPerBird, acc.totalRevenue.setScale(0, RoundingMode.HALF_UP), avgPrice, acc.lastDate
            ));
        }
        harvestRows.sort(Comparator.comparing(HarvestCycleRow::lastHarvestDate, Comparator.nullsLast(Comparator.reverseOrder())));
        BigDecimal harvestAvgPrice = totalHarvestKg.signum() > 0
                ? totalHarvestRev.divide(totalHarvestKg, 0, RoundingMode.HALF_UP) : BigDecimal.ZERO;
        HarvestReport harvestReport = new HarvestReport(
                totalHarvestEvents, totalHarvestHeads, totalHarvestKg.setScale(1, RoundingMode.HALF_UP),
                totalHarvestRev.setScale(0, RoundingMode.HALF_UP), harvestAvgPrice, harvestRows);

        // ── 7. Internal Stock Report ──────────────────────────────────────────────────────────
        List<InternalStockVoucher> vouchers = hasDateFilter
                ? internalVoucherRepository.findActiveInDateRangeForReport(rangeFrom, rangeTo)
                : internalVoucherRepository.findAllWithDetailsForReport().stream()
                        .filter(v -> !"CANCELLED".equalsIgnoreCase(v.getStatus()) && !"Đã hủy".equalsIgnoreCase(v.getStatus()))
                        .toList();

        int exportCount = 0, transferCount = 0;
        BigDecimal internalTotalAmt = BigDecimal.ZERO;
        List<InternalStockRow> internalRows = new ArrayList<>();
        for (InternalStockVoucher v : vouchers) {
            boolean isTransfer = "TRANSFER".equalsIgnoreCase(v.getMovementType()) || "Chuyển kho".equalsIgnoreCase(v.getMovementType());
            if (isTransfer) transferCount++;
            else exportCount++;

            String typeLabel = isTransfer ? "Chuyển kho"
                    : ("IMPORT".equalsIgnoreCase(v.getMovementType()) ? "Nhập nội bộ" : "Xuất kho");
            String catName = v.getCategory() != null ? v.getCategory().getName() : "Nội bộ";
            String srcWh = v.getSourceWarehouse() != null ? v.getSourceWarehouse().getName() : "—";
            String dst;
            if (v.getTargetWarehouse() != null) {
                dst = v.getTargetWarehouse().getName();
            } else if (v.getCycle() != null && v.getCycle().getBarn() != null) {
                dst = v.getCycle().getBarn().getName() + " (" + CycleService.cycleCode(v.getCycle()) + ")";
            } else {
                dst = "Sử dụng trang trại";
            }
            String vBarnName = v.getCycle() != null && v.getCycle().getBarn() != null ? v.getCycle().getBarn().getName() : "";
            String vAreaName = resolveVoucherAreaName(v, warehouseAreaMap);

            if (v.getItems() == null || v.getItems().isEmpty()) {
                BigDecimal amt = nz(v.getTotalAmount()).setScale(0, RoundingMode.HALF_UP);
                internalTotalAmt = internalTotalAmt.add(amt);
                internalRows.add(new InternalStockRow(
                        v.getId(), v.getCode(), v.getMovementDate(), typeLabel, catName,
                        catName, "—", BigDecimal.ONE, amt, amt, srcWh, dst, v.getStatus(),
                        vBarnName, vAreaName
                ));
            } else {
                for (InternalStockVoucherItem item : v.getItems()) {
                    BigDecimal amt = nz(item.getAmount()).setScale(0, RoundingMode.HALF_UP);
                    internalTotalAmt = internalTotalAmt.add(amt);
                    internalRows.add(new InternalStockRow(
                            v.getId(), v.getCode(), v.getMovementDate(), typeLabel, catName,
                            item.getProduct() != null ? item.getProduct().getName() : "Vật tư",
                            item.getUnit() != null ? item.getUnit().getName() : "",
                            nz(item.getQuantity()).stripTrailingZeros(),
                            nz(item.getUnitPrice()).setScale(0, RoundingMode.HALF_UP),
                            amt, srcWh, dst, v.getStatus(),
                            vBarnName, vAreaName
                    ));
                }
            }
        }
        InternalStockReport internalStockReport = new InternalStockReport(
                vouchers.size(), exportCount, transferCount,
                internalTotalAmt.setScale(0, RoundingMode.HALF_UP), internalRows);

        // ── 8. Activity Report (Aggregated Real Audit Feed) ───────────────────────────────────
        List<ActivityRow> activities = buildActivityFeed(
                cyclesInRange, movementsByCycle, weightsByCycle, expensesByCycle,
                salesInRange, purchasesInRange, vouchers, actorNameMap, warehouseAreaMap,
                hasDateFilter, rangeFrom, rangeTo);
        ActivityReport activityReport = new ActivityReport(activities.size(), activities);

        return new ReportSummaryResponse(
                from, to, today,
                farmSummary, salesReport, purchasesReport, inventoryReport,
                harvestReport, growthReport, internalStockReport, activityReport
        );
    }

    private List<ActivityRow> buildActivityFeed(
            List<FarmingCycle> cyclesInRange,
            Map<Long, List<FlockMovement>> movementsByCycle,
            Map<Long, List<WeightSample>> weightsByCycle,
            Map<Long, List<CycleExpense>> expensesByCycle,
            List<SalesOrder> sales,
            List<PurchaseInvoice> purchases,
            List<InternalStockVoucher> vouchers,
            Map<String, String> actorNameMap,
            Map<Long, String> warehouseAreaMap,
            boolean hasDateFilter,
            LocalDate rangeFrom,
            LocalDate rangeTo
    ) {
        List<ActivityRow> feed = new ArrayList<>();
        Set<Long> linkedHarvestMovementIds = new HashSet<>();
        Set<Long> linkedExpenseIds = new HashSet<>();

        for (SalesOrder o : sales) {
            if (o.getHarvestMovement() != null && o.getHarvestMovement().getId() != null) {
                linkedHarvestMovementIds.add(o.getHarvestMovement().getId());
            }
            LocalDateTime ts = o.getCreatedAt() != null ? o.getCreatedAt()
                    : (o.getDate() != null ? o.getDate().atTime(14, 0) : LocalDateTime.now(VN_ZONE));
            String customerName = nonBlank(o.getCustomer(), "Khách lẻ");
            String detail = "Bán " + o.getQuantity() + " con (" + nz(o.getTotalWeight()).stripTrailingZeros().toPlainString()
                    + " kg) cho " + customerName
                    + " · " + formatVndNumber(nz(o.getTotalAmount()).longValue()) + " đ";
            Barn oBarn = o.getCycle() != null ? o.getCycle().getBarn() : null;
            String barnName = oBarn != null ? oBarn.getName() : "";
            String areaName = oBarn != null && oBarn.getArea() != null ? oBarn.getArea().getName() : "";
            feed.add(new ActivityRow("sale-" + o.getId(), ts, o.getDate(), "Xuất bán · " + customerName,
                    "Bán hàng", "Xuất bán gà", detail, o.getCode(), barnName, areaName, o.getId()));
        }

        for (PurchaseInvoice p : purchases) {
            LocalDateTime ts = p.getCreatedAt() != null ? p.getCreatedAt()
                    : (p.getInvoiceDate() != null ? p.getInvoiceDate().atTime(10, 0) : LocalDateTime.now(VN_ZONE));
            String sup = p.getSupplier() != null ? p.getSupplier().getName() : "Nhà cung cấp";
            String detail = "Hóa đơn từ " + sup + " · "
                    + formatVndNumber(p.getTotalAmount() != null ? p.getTotalAmount() : 0L) + " đ (" + p.getStockStatus() + ")";
            feed.add(new ActivityRow("po-" + p.getId(), ts, p.getInvoiceDate(), "Nhập kho · " + sup,
                    "Nhập hàng", "Hóa đơn nhập", detail, p.getCode(),
                    resolvePurchaseBarnName(p), resolvePurchaseAreaName(p, warehouseAreaMap),
                    p.getId() != null ? String.valueOf(p.getId()) : null));
        }

        for (InternalStockVoucher v : vouchers) {
            if (v.getExpense() != null && v.getExpense().getId() != null) {
                linkedExpenseIds.add(v.getExpense().getId());
            }
            LocalDateTime ts = v.getCreatedAt() != null ? v.getCreatedAt()
                    : (v.getMovementDate() != null ? v.getMovementDate().atTime(9, 0) : LocalDateTime.now(VN_ZONE));
            String action = "TRANSFER".equalsIgnoreCase(v.getMovementType()) ? "Chuyển kho" : "Xuất kho nội bộ";
            String src = v.getSourceWarehouse() != null ? v.getSourceWarehouse().getName() : "Kho";
            String dst = v.getTargetWarehouse() != null ? v.getTargetWarehouse().getName()
                    : (v.getCycle() != null && v.getCycle().getBarn() != null ? v.getCycle().getBarn().getName() : "Chuồng nuôi");
            String detail = src + " -> " + dst + " (" + formatVndNumber(nz(v.getTotalAmount()).longValue()) + " đ)";
            String actor = resolveActorDisplayName(v.getCreatedBy(), actorNameMap, "Điều phối · " + src);
            String barnName = v.getCycle() != null && v.getCycle().getBarn() != null ? v.getCycle().getBarn().getName() : "";
            feed.add(new ActivityRow("iv-" + v.getId(), ts, v.getMovementDate(), actor,
                    "Xuất nhập nội bộ", action, detail, v.getCode(),
                    barnName, resolveVoucherAreaName(v, warehouseAreaMap),
                    v.getId() != null ? String.valueOf(v.getId()) : null));
        }

        List<DailyTaskLog> taskLogs = hasDateFilter
                ? dailyTaskLogRepository.findTop500ByTaskDateBetweenOrderByDoneAtDescIdDesc(rangeFrom, rangeTo)
                : dailyTaskLogRepository.findTop500ByOrderByDoneAtDescIdDesc();
        for (DailyTaskLog log : taskLogs) {
            if (log.getExpense() != null && log.getExpense().getId() != null) {
                linkedExpenseIds.add(log.getExpense().getId());
            }
            Barn logBarn = log.getCycle() != null ? log.getCycle().getBarn() : null;
            String barnName = logBarn != null ? logBarn.getName() : "Chuồng";
            String areaName = logBarn != null && logBarn.getArea() != null ? logBarn.getArea().getName() : "";
            String qty = log.getActualQuantity() != null
                    ? " · Thực tế: " + log.getActualQuantity().stripTrailingZeros().toPlainString()
                      + (log.getUsageUnit() != null ? " " + log.getUsageUnit().name().toLowerCase(Locale.ROOT) : "")
                    : "";
            String detail = barnName + " · " + log.getTaskName() + qty;
            String actor = resolveActorDisplayName(log.getDoneBy(), actorNameMap, "Công nhân");
            feed.add(new ActivityRow(
                    "task-" + log.getId(), log.getDoneAt(), log.getTaskDate(),
                    actor, "Ghi nhật ký", "Xác nhận việc", detail,
                    log.getCycle() != null ? CycleService.cycleCode(log.getCycle()) : "",
                    logBarn != null ? logBarn.getName() : "",
                    areaName,
                    logBarn != null && logBarn.getId() != null ? String.valueOf(logBarn.getId()) : null
            ));
        }

        List<WorkTaskCheck> workChecks = hasDateFilter
                ? workTaskCheckRepository.findTop300ByCheckDateBetweenOrderByDoneAtDescIdDesc(rangeFrom, rangeTo)
                : workTaskCheckRepository.findTop300ByOrderByDoneAtDescIdDesc();
        for (WorkTaskCheck check : workChecks) {
            WorkTask task = check.getTask();
            Barn barn = task != null ? task.getBarn() : null;
            String barnName = barn != null ? barn.getName() : "Chuồng";
            String areaName = barn != null && barn.getArea() != null ? barn.getArea().getName() : "";
            Long barnId = barn != null ? barn.getId() : null;
            String cycleCode = resolveCycleCodeForBarnDate(cyclesInRange, barnId, check.getCheckDate());
            String noteSuffix = check.getNote() != null && !check.getNote().isBlank() ? " (" + check.getNote().trim() + ")" : "";
            String detail = barnName + " · " + (task != null ? task.getTitle() : "Công việc chăm sóc") + noteSuffix;
            String actor = resolveActorDisplayName(check.getDoneBy(), actorNameMap, "Công nhân");
            feed.add(new ActivityRow(
                    "wt-" + check.getId(), check.getDoneAt(), check.getCheckDate(),
                    actor, "Ghi nhật ký", "Vệ sinh & chăm sóc", detail,
                    cycleCode, barn != null ? barn.getName() : "", areaName,
                    barnId != null ? String.valueOf(barnId) : null
            ));
        }

        for (FarmingCycle cycle : cyclesInRange) {
            Long cycleId = cycle.getId();
            Barn barn = cycle.getBarn();
            String barnName = barn != null ? barn.getName() : "Chuồng";
            String areaName = barn != null && barn.getArea() != null ? barn.getArea().getName() : "";
            String cycleCode = CycleService.cycleCode(cycle);
            String barnRefId = barn != null && barn.getId() != null ? String.valueOf(barn.getId()) : null;

            for (WeightSample ws : weightsByCycle.getOrDefault(cycleId, List.of())) {
                if (hasDateFilter && !inDateRange(ws.getSampleDate(), rangeFrom, rangeTo)) continue;
                LocalDateTime ts = ws.getCreatedAt() != null ? ws.getCreatedAt()
                        : (ws.getSampleDate() != null ? ws.getSampleDate().atTime(9, 0) : LocalDateTime.now(VN_ZONE));
                String sampleSizeText = ws.getSampleSize() != null ? ws.getSampleSize() + " con · " : "";
                String avgText = ws.getAvgWeightKg() != null ? ws.getAvgWeightKg().stripTrailingZeros().toPlainString() : "0";
                String detail = barnName + " · Cân " + sampleSizeText + "TB " + avgText + " kg/con"
                        + (ws.getNote() != null && !ws.getNote().isBlank() ? " (" + ws.getNote().trim() + ")" : "");
                String actor = resolveActorDisplayName(ws.getCreatedBy(), actorNameMap, "Kỹ thuật trại");
                feed.add(new ActivityRow(
                        "ws-" + ws.getId(), ts, ws.getSampleDate(),
                        actor, "Ghi nhật ký", "Cân mẫu", detail,
                        cycleCode, barn != null ? barn.getName() : "", areaName, barnRefId
                ));
            }

            for (FlockMovement m : movementsByCycle.getOrDefault(cycleId, List.of())) {
                if (m.getId() != null && linkedHarvestMovementIds.contains(m.getId())) continue;
                if (hasDateFilter && !inDateRange(m.getMovementDate(), rangeFrom, rangeTo)) continue;
                LocalDateTime ts = m.getCreatedAt() != null ? m.getCreatedAt()
                        : (m.getMovementDate() != null ? m.getMovementDate().atTime(17, 0) : LocalDateTime.now(VN_ZONE));
                String flockName = m.getFlock() != null && m.getFlock().getName() != null ? m.getFlock().getName() : "đàn";
                String module;
                String action;
                String qtyPart;
                switch (m.getType()) {
                    case DEATH -> {
                        module = "Ghi nhật ký";
                        action = "Hao hụt đàn";
                        qtyPart = "Chết " + m.getQuantity() + " con (" + flockName + ")";
                    }
                    case CULL -> {
                        module = "Ghi nhật ký";
                        action = "Loại thải";
                        qtyPart = "Loại thải " + m.getQuantity() + " con (" + flockName + ")";
                    }
                    case IMPORT -> {
                        module = "Đàn gia cầm";
                        action = "Nhập đàn giống";
                        qtyPart = "Nhập " + m.getQuantity() + " con (" + flockName + ")";
                    }
                    case TRANSFER_IN -> {
                        module = "Đàn gia cầm";
                        action = "Nhận chuyển đàn";
                        qtyPart = "Nhận " + m.getQuantity() + " con (" + flockName + ")";
                    }
                    case TRANSFER_OUT -> {
                        module = "Đàn gia cầm";
                        action = "Chuyển đàn đi";
                        qtyPart = "Chuyển " + m.getQuantity() + " con (" + flockName + ")";
                    }
                    case HARVEST -> {
                        module = "Đàn gia cầm";
                        action = "Xuất chuồng trực tiếp";
                        String wPart = m.getWeightKg() != null ? " (" + m.getWeightKg().stripTrailingZeros().toPlainString() + " kg)" : "";
                        qtyPart = "Xuất " + m.getQuantity() + " con" + wPart;
                    }
                    default -> { continue; }
                }
                String noteSuffix = m.getNote() != null && !m.getNote().isBlank() ? " · " + m.getNote().trim() : "";
                String detail = barnName + " · " + qtyPart + noteSuffix;
                String actor = resolveActorDisplayName(m.getCreatedBy(), actorNameMap, "Nhân sự trại");
                feed.add(new ActivityRow(
                        "mov-" + m.getId(), ts, m.getMovementDate(),
                        actor, module, action, detail,
                        cycleCode, barn != null ? barn.getName() : "", areaName, barnRefId
                ));
            }

            for (CycleExpense exp : expensesByCycle.getOrDefault(cycleId, List.of())) {
                if (exp.getId() != null && linkedExpenseIds.contains(exp.getId())) continue;
                if (exp.getCategory() == null || !exp.getCategory().countsInCycleCost()) continue;
                if (hasDateFilter && !inDateRange(exp.getExpenseDate(), rangeFrom, rangeTo)) continue;
                LocalDateTime ts = exp.getCreatedAt() != null ? exp.getCreatedAt()
                        : (exp.getExpenseDate() != null ? exp.getExpenseDate().atTime(10, 30) : LocalDateTime.now(VN_ZONE));
                String catLabel = exp.getCategory() == ExpenseCategory.MEDICINE ? "Thuốc & vắc-xin" : "Chi phí khác";
                String noteSuffix = exp.getNote() != null && !exp.getNote().isBlank() ? " · " + exp.getNote().trim() : "";
                String detail = barnName + " · " + catLabel + " · " + formatVndNumber(nz(exp.getAmount()).longValue()) + " đ" + noteSuffix;
                String actor = resolveActorDisplayName(exp.getCreatedBy(), actorNameMap, "Kế toán trại");
                feed.add(new ActivityRow(
                        "exp-" + exp.getId(), ts, exp.getExpenseDate(),
                        actor, "Ghi nhật ký", "Chi phí lứa", detail,
                        cycleCode, barn != null ? barn.getName() : "", areaName, barnRefId
                ));
            }
        }

        return feed.stream()
                .sorted(Comparator.comparing(ActivityRow::timestamp, Comparator.nullsLast(Comparator.reverseOrder()))
                        .thenComparing(ActivityRow::id, Comparator.reverseOrder()))
                .limit(MAX_ACTIVITY_FEED)
                .toList();
    }

    private static boolean inDateRange(LocalDate d, LocalDate from, LocalDate to) {
        return d == null || (!d.isBefore(from) && !d.isAfter(to));
    }

    private static String resolveCycleCodeForBarnDate(List<FarmingCycle> cycles, Long barnId, LocalDate date) {
        if (barnId == null) return "";
        FarmingCycle matched = null;
        for (FarmingCycle c : cycles) {
            if (c.getBarn() == null || !barnId.equals(c.getBarn().getId())) continue;
            boolean startsOk = date == null || c.getStartDate() == null || !date.isBefore(c.getStartDate());
            boolean endsOk = date == null || c.getEndDate() == null || !date.isAfter(c.getEndDate());
            if (startsOk && endsOk) return CycleService.cycleCode(c);
            if (matched == null) matched = c;
        }
        return matched != null ? CycleService.cycleCode(matched) : "";
    }

    private static String formatVndNumber(long amount) {
        return NumberFormat.getIntegerInstance(VI_LOCALE).format(amount);
    }

    private Map<String, String> buildActorNameMap() {
        Map<String, String> map = new HashMap<>();
        map.put("admin", "Admin");
        for (Account acc : accountRepository.findAll()) {
            if (acc.getEmail() != null && !acc.getEmail().isBlank()
                    && acc.getFullName() != null && !acc.getFullName().isBlank()) {
                map.put(acc.getEmail().trim().toLowerCase(Locale.ROOT), acc.getFullName().trim());
            }
        }
        return map;
    }

    private Map<Long, String> buildWarehouseAreaMap() {
        Map<Long, String> map = new HashMap<>();
        for (WarehouseCategory w : warehouseRepository.findAllWithAreasForReport()) {
            if (w.getId() == null) continue;
            Set<String> areaNames = new LinkedHashSet<>();
            if (w.getArea() != null && w.getArea().getName() != null && !w.getArea().getName().isBlank()) {
                areaNames.add(w.getArea().getName().trim());
            }
            if (w.getAreas() != null) {
                for (FarmArea a : w.getAreas()) {
                    if (a != null && a.getName() != null && !a.getName().isBlank()) {
                        areaNames.add(a.getName().trim());
                    }
                }
            }
            if (!areaNames.isEmpty()) {
                map.put(w.getId(), String.join(", ", areaNames));
            }
        }
        return map;
    }

    private static String resolveWarehouseArea(WarehouseCategory wh, Map<Long, String> warehouseAreaMap) {
        if (wh == null) return "";
        if (wh.getId() != null) {
            String mapped = warehouseAreaMap.get(wh.getId());
            if (mapped != null && !mapped.isBlank()) return mapped;
        }
        return wh.getArea() != null && wh.getArea().getName() != null ? wh.getArea().getName() : "";
    }

    private static String resolveCycleBreed(List<Flock> flocks, Flock fallbackFlock) {
        String breed = flocks.stream()
                .map(Flock::getProgram).filter(Objects::nonNull).map(FarmingProgram::getBreed)
                .filter(b -> b != null && !b.isBlank()).findFirst().orElse(null);
        if (breed != null) return breed;
        if (fallbackFlock != null && fallbackFlock.getProgram() != null
                && fallbackFlock.getProgram().getBreed() != null && !fallbackFlock.getProgram().getBreed().isBlank()) {
            return fallbackFlock.getProgram().getBreed();
        }
        return flocks.stream().map(Flock::getName).filter(Objects::nonNull).findFirst()
                .orElse(fallbackFlock != null && fallbackFlock.getName() != null ? fallbackFlock.getName() : "Gà thịt");
    }

    private static String resolvePurchaseBarnName(PurchaseInvoice p) {
        if (p.getFlock() != null && p.getFlock().getCycle() != null && p.getFlock().getCycle().getBarn() != null) {
            return p.getFlock().getCycle().getBarn().getName();
        }
        return "";
    }

    private static String resolvePurchaseAreaName(PurchaseInvoice p, Map<Long, String> warehouseAreaMap) {
        if (p.getFlock() != null && p.getFlock().getCycle() != null
                && p.getFlock().getCycle().getBarn() != null
                && p.getFlock().getCycle().getBarn().getArea() != null) {
            return p.getFlock().getCycle().getBarn().getArea().getName();
        }
        if (p.getItems() == null || p.getItems().isEmpty()) return "";
        Set<String> areas = new LinkedHashSet<>();
        for (PurchaseInvoiceItem item : p.getItems()) {
            String area = resolveWarehouseArea(item.getWarehouse(), warehouseAreaMap);
            if (!area.isBlank()) areas.add(area);
        }
        return String.join(", ", areas);
    }

    private static String resolveVoucherAreaName(InternalStockVoucher v, Map<Long, String> warehouseAreaMap) {
        if (v.getCycle() != null && v.getCycle().getBarn() != null && v.getCycle().getBarn().getArea() != null) {
            return v.getCycle().getBarn().getArea().getName();
        }
        Set<String> areas = new LinkedHashSet<>();
        String srcArea = resolveWarehouseArea(v.getSourceWarehouse(), warehouseAreaMap);
        if (!srcArea.isBlank()) areas.add(srcArea);
        String dstArea = resolveWarehouseArea(v.getTargetWarehouse(), warehouseAreaMap);
        if (!dstArea.isBlank()) areas.add(dstArea);
        return String.join(", ", areas);
    }

    private static String resolveActorDisplayName(String rawActor, Map<String, String> actorNameMap, String fallback) {
        if (rawActor == null || rawActor.isBlank()) {
            return fallback;
        }
        String trimmed = rawActor.trim();
        String mapped = actorNameMap.get(trimmed.toLowerCase(Locale.ROOT));
        return mapped != null && !mapped.isBlank() ? mapped : trimmed;
    }

    private static String summarizePurchaseTarget(PurchaseInvoice p) {
        if (p.getFlock() != null && p.getFlock().getCycle() != null && p.getFlock().getCycle().getBarn() != null) {
            return "Nhập chuồng " + p.getFlock().getCycle().getBarn().getName();
        }
        if (p.getItems() == null || p.getItems().isEmpty()) {
            return "Kho trang trại";
        }
        Set<String> warehouses = new LinkedHashSet<>();
        for (PurchaseInvoiceItem item : p.getItems()) {
            if (item.getWarehouse() != null && item.getWarehouse().getName() != null) {
                warehouses.add(item.getWarehouse().getName());
            }
        }
        if (warehouses.isEmpty()) return p.getItems().size() + " mặt hàng";
        return String.join(", ", warehouses);
    }

    private static boolean overlapsRange(LocalDate start, LocalDate end, LocalDate from, LocalDate to) {
        if (from == null && to == null) return true;
        LocalDate effectiveStart = start != null ? start : LocalDate.MIN;
        LocalDate effectiveEnd = end != null ? end : LocalDate.MAX;
        if (from != null && effectiveEnd.isBefore(from)) return false;
        if (to != null && effectiveStart.isAfter(to)) return false;
        return true;
    }

    private static boolean isInPeriod(LocalDate date, LocalDate from, LocalDate to, boolean hasDateFilter) {
        if (!hasDateFilter) return true;
        if (date == null) return false;
        if (from != null && date.isBefore(from)) return false;
        if (to != null && date.isAfter(to)) return false;
        return true;
    }

    private static boolean isOnOrBefore(LocalDate date, LocalDate cutoff) {
        return date == null || !date.isAfter(cutoff);
    }

    private static BigDecimal nz(BigDecimal val) {
        return val == null ? BigDecimal.ZERO : val;
    }

    private static String nonBlank(String s, String fallback) {
        return s != null && !s.isBlank() ? s : fallback;
    }

    private static Map<Long, List<Flock>> groupFlocksByCycle(List<Flock> list) {
        Map<Long, List<Flock>> map = new HashMap<>();
        for (Flock f : list) {
            if (f.getCycle() != null) map.computeIfAbsent(f.getCycle().getId(), k -> new ArrayList<>()).add(f);
        }
        return map;
    }

    private static Map<Long, List<FlockMovement>> groupMovementsByCycle(List<FlockMovement> list) {
        Map<Long, List<FlockMovement>> map = new HashMap<>();
        for (FlockMovement m : list) {
            if (m.getFlock() != null && m.getFlock().getCycle() != null) {
                map.computeIfAbsent(m.getFlock().getCycle().getId(), k -> new ArrayList<>()).add(m);
            }
        }
        return map;
    }

    private static Map<Long, List<FeedRecord>> groupFeedsByCycle(List<FeedRecord> list) {
        Map<Long, List<FeedRecord>> map = new HashMap<>();
        for (FeedRecord f : list) {
            if (f.getCycle() != null) map.computeIfAbsent(f.getCycle().getId(), k -> new ArrayList<>()).add(f);
        }
        return map;
    }

    private static Map<Long, List<WeightSample>> groupWeightsByCycle(List<WeightSample> list) {
        Map<Long, List<WeightSample>> map = new HashMap<>();
        for (WeightSample w : list) {
            if (w.getCycle() != null) map.computeIfAbsent(w.getCycle().getId(), k -> new ArrayList<>()).add(w);
        }
        return map;
    }

    private static Map<Long, List<CycleExpense>> groupExpensesByCycle(List<CycleExpense> list) {
        Map<Long, List<CycleExpense>> map = new HashMap<>();
        for (CycleExpense e : list) {
            if (e.getCycle() != null) map.computeIfAbsent(e.getCycle().getId(), k -> new ArrayList<>()).add(e);
        }
        return map;
    }

    private static Map<Long, List<CycleCarriedExpense>> groupCarriedByCycle(List<CycleCarriedExpense> list) {
        Map<Long, List<CycleCarriedExpense>> map = new HashMap<>();
        for (CycleCarriedExpense ce : list) {
            if (ce.getCycle() != null) map.computeIfAbsent(ce.getCycle().getId(), k -> new ArrayList<>()).add(ce);
        }
        return map;
    }

    private static class HarvestAccumulator {
        final Long cycleId;
        final String cycleCode;
        final String barnName;
        final String areaName;
        final String breed;
        int events = 0;
        int totalHead = 0;
        BigDecimal totalWeight = BigDecimal.ZERO;
        BigDecimal totalRevenue = BigDecimal.ZERO;
        LocalDate lastDate = null;

        HarvestAccumulator(Long cycleId, String cycleCode, String barnName, String areaName, String breed) {
            this.cycleId = cycleId;
            this.cycleCode = cycleCode;
            this.barnName = barnName;
            this.areaName = areaName;
            this.breed = breed;
        }
    }
}
