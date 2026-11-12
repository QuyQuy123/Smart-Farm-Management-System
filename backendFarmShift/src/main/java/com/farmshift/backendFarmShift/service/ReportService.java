package com.farmshift.backendFarmShift.service;

import com.farmshift.backendFarmShift.dto.response.ReportSummaryResponse;
import com.farmshift.backendFarmShift.dto.response.ReportSummaryResponse.*;
import com.farmshift.backendFarmShift.entity.*;
import com.farmshift.backendFarmShift.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
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
    private static final NumberFormat VN_NUMBER = NumberFormat.getIntegerInstance(Locale.forLanguageTag("vi-VN"));

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

    public ReportSummaryResponse getSummary(LocalDate from, LocalDate to) {
        LocalDate today = LocalDate.now(VN_ZONE);

        List<FarmingCycle> allCycles = cycleRepository.findAllWithBarnAndAreaForReport();
        Map<Long, List<Flock>> flocksByCycle = groupFlocksByCycle(flockRepository.findAllByOrderByImportDateAscIdAsc());
        Map<Long, List<FlockMovement>> movementsByCycle = groupMovementsByCycle(movementRepository.findAllByOrderByMovementDateAscIdAsc());
        Map<Long, List<FeedRecord>> feedsByCycle = groupFeedsByCycle(feedRepository.findAllByOrderByRecordDateDescIdDesc());
        Map<Long, List<WeightSample>> weightsByCycle = groupWeightsByCycle(weightRepository.findAllByOrderBySampleDateDescIdDesc());
        Map<Long, List<CycleExpense>> expensesByCycle = groupExpensesByCycle(expenseRepository.findAllWithCycleBy());
        Map<Long, List<CycleCarriedExpense>> carriedByCycle = groupCarriedByCycle(carriedExpenseRepository.findAllWithCycleBy());

        List<FarmingCycle> cyclesInRange = allCycles.stream()
                .filter(c -> overlapsRange(c.getStartDate(), c.getEndDate(), from, to))
                .sorted(Comparator
                        .comparing((FarmingCycle c) -> c.getStatus() == CycleStatus.ACTIVE ? 0 : 1)
                        .thenComparing(FarmingCycle::getStartDate, Comparator.nullsLast(Comparator.reverseOrder()))
                        .thenComparing(FarmingCycle::getId, Comparator.reverseOrder()))
                .toList();

        // ── 1. Farm Summary & 7. Growth (FCR) ────────────────────────────────────────────────
        int sumIn = 0, sumHarvested = 0, sumDeaths = 0, sumCulls = 0, sumLive = 0, activeBarns = 0;
        BigDecimal sumHarvestedWeight = BigDecimal.ZERO;
        BigDecimal sumCost = BigDecimal.ZERO, sumRevenue = BigDecimal.ZERO;

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

            int totalIn = 0, deaths = 0, culls = 0, harvested = 0, transferredOut = 0;
            BigDecimal inWeight = BigDecimal.ZERO, outWeight = BigDecimal.ZERO, harvestedWeight = BigDecimal.ZERO;
            BigDecimal chickCost = BigDecimal.ZERO, harvestRevenue = BigDecimal.ZERO;

            for (FlockMovement m : movements) {
                BigDecimal w = nz(m.getWeightKg());
                BigDecimal unitPrice = m.getFlock() != null && m.getFlock().getUnitPrice() != null
                        ? m.getFlock().getUnitPrice() : BigDecimal.ZERO;
                switch (m.getType()) {
                    case IMPORT, TRANSFER_IN -> {
                        totalIn += m.getQuantity();
                        inWeight = inWeight.add(w);
                        chickCost = chickCost.add(unitPrice.multiply(BigDecimal.valueOf(m.getQuantity())));
                    }
                    case DEATH -> deaths += m.getQuantity();
                    case CULL -> {
                        culls += m.getQuantity();
                        outWeight = outWeight.add(w);
                    }
                    case HARVEST -> {
                        harvested += m.getQuantity();
                        outWeight = outWeight.add(w);
                        harvestedWeight = harvestedWeight.add(w);
                        if (m.getWeightKg() != null && m.getUnitPrice() != null) {
                            harvestRevenue = harvestRevenue.add(m.getWeightKg().multiply(m.getUnitPrice()));
                        }
                    }
                    case TRANSFER_OUT -> {
                        transferredOut += m.getQuantity();
                        outWeight = outWeight.add(w);
                        chickCost = chickCost.subtract(unitPrice.multiply(BigDecimal.valueOf(m.getQuantity())));
                    }
                }
            }

            int currentQty = flocks.stream().mapToInt(Flock::getQuantity).sum();
            LocalDate reference = cycle.getEndDate() != null ? cycle.getEndDate() : today;

            BigDecimal feedKg = feeds.stream().map(FeedRecord::getQuantityKg).reduce(nz(cycle.getCarriedFeedKg()), BigDecimal::add);
            BigDecimal feedCost = feeds.stream()
                    .map(f -> nz(f.getQuantityKg()).multiply(nz(f.getUnitPrice())))
                    .reduce(nz(cycle.getCarriedFeedCost()), BigDecimal::add);

            Map<ExpenseCategory, BigDecimal> expenseByCat = new EnumMap<>(ExpenseCategory.class);
            for (CycleExpense e : expenses) {
                if (e.getCategory() != null) {
                    expenseByCat.merge(e.getCategory(), nz(e.getAmount()), BigDecimal::add);
                }
            }
            for (CycleCarriedExpense ce : carriedExpenses) {
                if (ce.getCategory() != null) {
                    expenseByCat.merge(ce.getCategory(), nz(ce.getAmount()), BigDecimal::add);
                }
            }
            BigDecimal otherCost = expenseByCat.entrySet().stream()
                    .filter(entry -> entry.getKey().countsInCycleCost())
                    .map(Map.Entry::getValue)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal cycleTotalCost = chickCost.add(feedCost).add(otherCost).setScale(0, RoundingMode.HALF_UP);
            BigDecimal cycleRevenue = harvestRevenue.setScale(0, RoundingMode.HALF_UP);
            BigDecimal cycleProfit = cycleRevenue.subtract(cycleTotalCost);

            int lossCount = deaths + culls;
            BigDecimal survivalRate = totalIn > 0
                    ? BigDecimal.valueOf((totalIn - lossCount) * 100.0 / totalIn).setScale(2, RoundingMode.HALF_UP)
                    : BigDecimal.valueOf(100);

            FarmingProgram program = flocks.stream()
                    .map(Flock::getProgram)
                    .filter(Objects::nonNull)
                    .findFirst()
                    .orElse(null);
            String breed = program != null && program.getBreed() != null && !program.getBreed().isBlank()
                    ? program.getBreed()
                    : flocks.stream().map(Flock::getName).filter(Objects::nonNull).findFirst().orElse("Gà thịt");

            barnRows.add(new BarnCycleRow(
                    cycleId, cycleCode, barnName, areaName, breed,
                    cycle.getStatus() != null ? cycle.getStatus().name() : "ACTIVE",
                    cycle.getStartDate(), cycle.getEndDate(),
                    totalIn, deaths, culls, harvested, transferredOut, currentQty,
                    survivalRate, cycleTotalCost, cycleRevenue, cycleProfit
            ));

            sumIn += totalIn;
            sumHarvested += harvested;
            sumHarvestedWeight = sumHarvestedWeight.add(harvestedWeight);
            sumDeaths += deaths;
            sumCulls += culls;
            sumLive += currentQty;
            if (cycle.getStatus() == CycleStatus.ACTIVE) activeBarns++;
            sumCost = sumCost.add(cycleTotalCost);
            sumRevenue = sumRevenue.add(cycleRevenue);

            // Growth / FCR row
            Integer ageDays = cycle.getHatchDate() != null
                    ? (int) ChronoUnit.DAYS.between(cycle.getHatchDate(), reference) + 1
                    : flocks.isEmpty() ? null : CycleService.ageOn(flocks.get(0), reference);

            BigDecimal avgWeightKg = samples.stream()
                    .filter(s -> s.getSampleDate() != null && !s.getSampleDate().isAfter(reference))
                    .findFirst()
                    .map(WeightSample::getAvgWeightKg)
                    .orElse(harvested > 0 && harvestedWeight.signum() > 0
                            ? harvestedWeight.divide(BigDecimal.valueOf(harvested), 3, RoundingMode.HALF_UP)
                            : totalIn > 0 && inWeight.signum() > 0
                            ? inWeight.divide(BigDecimal.valueOf(totalIn), 3, RoundingMode.HALF_UP)
                            : null);

            BigDecimal rawBiomass = avgWeightKg == null ? BigDecimal.ZERO : avgWeightKg.multiply(BigDecimal.valueOf(currentQty));
            BigDecimal gainKg = rawBiomass.add(outWeight).subtract(inWeight).add(nz(cycle.getCarriedGainKg()));
            BigDecimal fcr = gainKg.signum() > 0 && feedKg.signum() > 0
                    ? feedKg.divide(gainKg, 2, RoundingMode.HALF_UP) : null;

            int headBase = currentQty + harvested;
            BigDecimal feedPerBirdKg = headBase > 0 && feedKg.signum() > 0
                    ? feedKg.divide(BigDecimal.valueOf(headBase), 2, RoundingMode.HALF_UP)
                    : (totalIn > 0 && feedKg.signum() > 0 ? feedKg.divide(BigDecimal.valueOf(totalIn), 2, RoundingMode.HALF_UP) : null);

            BigDecimal initialAvg = totalIn > 0 && inWeight.signum() > 0
                    ? inWeight.divide(BigDecimal.valueOf(totalIn), 3, RoundingMode.HALF_UP) : BigDecimal.ZERO;
            BigDecimal adgGrams = (ageDays != null && ageDays > 0 && avgWeightKg != null)
                    ? avgWeightKg.subtract(initialAvg).max(BigDecimal.ZERO)
                            .multiply(BigDecimal.valueOf(1000))
                            .divide(BigDecimal.valueOf(ageDays), 1, RoundingMode.HALF_UP)
                    : null;

            BigDecimal targetWeightKg = program != null && program.getTargetWeightMax() != null
                    ? program.getTargetWeightMax()
                    : (barn != null ? barn.getTargetWeight() : null);

            if (totalIn > 0 || feedKg.signum() > 0) {
                growthRows.add(new GrowthCycleRow(
                        cycleId, cycleCode, barnName, areaName, breed,
                        cycle.getStatus() != null ? cycle.getStatus().name() : "ACTIVE",
                        ageDays, program != null ? program.getDurationDays() : null,
                        totalIn, currentQty, avgWeightKg, targetWeightKg,
                        feedKg.setScale(1, RoundingMode.HALF_UP), feedPerBirdKg,
                        gainKg.setScale(1, RoundingMode.HALF_UP), fcr, adgGrams, survivalRate
                ));
            }
        }

        int totalLoss = sumDeaths + sumCulls;
        BigDecimal farmLossRate = sumIn > 0
                ? BigDecimal.valueOf(totalLoss * 100.0 / sumIn).setScale(2, RoundingMode.HALF_UP) : BigDecimal.ZERO;
        BigDecimal farmSurvivalRate = sumIn > 0
                ? BigDecimal.valueOf(100.0).subtract(farmLossRate).max(BigDecimal.ZERO) : BigDecimal.valueOf(100);

        FarmSummary farmSummary = new FarmSummary(
                sumIn, sumHarvested, sumHarvestedWeight.setScale(1, RoundingMode.HALF_UP),
                sumDeaths, sumCulls, sumLive, activeBarns, cyclesInRange.size(),
                farmLossRate, farmSurvivalRate,
                sumCost.setScale(0, RoundingMode.HALF_UP),
                sumRevenue.setScale(0, RoundingMode.HALF_UP),
                sumRevenue.subtract(sumCost).setScale(0, RoundingMode.HALF_UP),
                barnRows
        );

        List<BigDecimal> validFcrs = growthRows.stream().map(GrowthCycleRow::fcr).filter(Objects::nonNull).toList();
        BigDecimal avgFcr = validFcrs.isEmpty() ? null
                : validFcrs.stream().reduce(BigDecimal.ZERO, BigDecimal::add)
                        .divide(BigDecimal.valueOf(validFcrs.size()), 2, RoundingMode.HALF_UP);
        GrowthReport growthReport = new GrowthReport(growthRows.size(), avgFcr, growthRows);

        // ── 2. Sales Report ───────────────────────────────────────────────────────────────────
        List<SalesOrder> salesInRange = salesOrderRepository.findAll(Sort.by("date").descending().and(Sort.by("id").descending()))
                .stream()
                .filter(o -> inDateRange(o.getDate(), from, to))
                .toList();

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
            salesRows.add(new SalesOrderRow(
                    o.getId(), o.getCode(), o.getDate(), o.getCustomer(), o.getFlock(),
                    o.getQuantity(), wt, nz(o.getUnitPrice()), totalAmt, paidAmt, debtAmt, o.getStatus()
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
        List<PurchaseInvoice> purchasesInRange = purchaseInvoiceRepository.findAllWithDetailsForReport()
                .stream()
                .filter(p -> inDateRange(p.getInvoiceDate(), from, to))
                .toList();

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
            purchaseRows.add(new PurchaseRow(
                    p.getId(), p.getCode(), p.getInvoiceDate(),
                    p.getSupplier() != null ? p.getSupplier().getName() : "—",
                    whSummary, total, paid, debt, p.getPaymentStatus(), p.getStockStatus()
            ));
        }
        PurchasesReport purchasesReport = new PurchasesReport(purValidCount, purCancelledCount, purTotal, purPaid, purDebt, purchaseRows);

        // ── 4. Inventory Report (current stock snapshot) ──────────────────────────────────────
        List<InventoryItem> inventoryItems = inventoryRepository.findAllWithDetailsBy(Sort.by("warehouse.name", "product.name"));
        BigDecimal invTotalValue = BigDecimal.ZERO;
        int lowStockCount = 0, expiryAlertCount = 0;
        List<InventoryRow> inventoryRows = new ArrayList<>();
        for (InventoryItem item : inventoryItems) {
            BigDecimal stock = nz(item.getStock());
            BigDecimal unitPrice = nz(item.getPrice());
            BigDecimal value = stock.multiply(unitPrice).setScale(0, RoundingMode.HALF_UP);
            boolean low = InventoryItemService.isLowStock(item);
            String expStatus = InventoryItemService.computeExpiryStatus(
                    item.getExpiryDate(), today, InventoryItemService.DEFAULT_NEAR_EXPIRY_DAYS);
            if (low) lowStockCount++;
            if ("EXPIRED".equals(expStatus) || "NEAR_EXPIRY".equals(expStatus)) expiryAlertCount++;
            invTotalValue = invTotalValue.add(value);
            inventoryRows.add(new InventoryRow(
                    item.getId(),
                    String.format(Locale.ROOT, "SP%05d", item.getId()),
                    item.getProduct() != null ? item.getProduct().getName() : "Hàng hóa",
                    item.getWarehouse() != null ? item.getWarehouse().getName() : "Kho",
                    item.getProduct() != null ? item.getProduct().getProductType() : "",
                    item.getUnit() != null ? item.getUnit().getName() : "",
                    stock.setScale(2, RoundingMode.HALF_UP).stripTrailingZeros(),
                    item.getMinStock() != null ? item.getMinStock().stripTrailingZeros() : null,
                    unitPrice.setScale(0, RoundingMode.HALF_UP),
                    value,
                    item.getLotNumber(),
                    item.getExpiryDate(),
                    low,
                    expStatus
            ));
        }
        InventoryReport inventoryReport = new InventoryReport(
                inventoryRows.size(), invTotalValue, lowStockCount, expiryAlertCount, inventoryRows);

        // ── 5. Harvest Report ─────────────────────────────────────────────────────────────────
        Map<Long, HarvestAccumulator> harvestMap = new LinkedHashMap<>();
        for (FarmingCycle cycle : allCycles) {
            List<FlockMovement> harvestMoves = movementsByCycle.getOrDefault(cycle.getId(), List.of())
                    .stream()
                    .filter(m -> m.getType() == FlockMovementType.HARVEST && inDateRange(m.getMovementDate(), from, to))
                    .toList();
            if (harvestMoves.isEmpty()) continue;

            Barn barn = cycle.getBarn();
            String barnName = barn != null ? barn.getName() : "Trang trại";
            String areaName = barn != null && barn.getArea() != null ? barn.getArea().getName() : "";
            List<Flock> flocks = flocksByCycle.getOrDefault(cycle.getId(), List.of());
            String breed = flocks.stream()
                    .map(Flock::getProgram).filter(Objects::nonNull).map(FarmingProgram::getBreed)
                    .filter(b -> b != null && !b.isBlank()).findFirst()
                    .orElse(flocks.stream().map(Flock::getName).filter(Objects::nonNull).findFirst().orElse("Gà thịt"));

            HarvestAccumulator acc = harvestMap.computeIfAbsent(cycle.getId(),
                    k -> new HarvestAccumulator(cycle.getId(), CycleService.cycleCode(cycle), barnName, areaName, breed));
            for (FlockMovement m : harvestMoves) {
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

        // ── 8. Internal Stock Report ──────────────────────────────────────────────────────────
        List<InternalStockVoucher> vouchers = internalVoucherRepository.findAllWithDetailsForReport()
                .stream()
                .filter(v -> !"CANCELLED".equalsIgnoreCase(v.getStatus()) && !"Đã hủy".equalsIgnoreCase(v.getStatus()))
                .filter(v -> inDateRange(v.getMovementDate(), from, to))
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

            if (v.getItems() == null || v.getItems().isEmpty()) {
                BigDecimal amt = nz(v.getTotalAmount()).setScale(0, RoundingMode.HALF_UP);
                internalTotalAmt = internalTotalAmt.add(amt);
                internalRows.add(new InternalStockRow(
                        v.getId(), v.getCode(), v.getMovementDate(), typeLabel, catName,
                        catName, "—", BigDecimal.ONE, amt, amt, srcWh, dst, v.getStatus()
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
                            amt, srcWh, dst, v.getStatus()
                    ));
                }
            }
        }
        InternalStockReport internalStockReport = new InternalStockReport(
                vouchers.size(), exportCount, transferCount,
                internalTotalAmt.setScale(0, RoundingMode.HALF_UP), internalRows);

        // ── 8. Activity Report (Aggregated Real Audit Feed) ───────────────────────────────────
        List<ActivityRow> activities = buildActivityFeed(
                salesInRange, purchasesInRange, vouchers, from, to);
        ActivityReport activityReport = new ActivityReport(activities.size(), activities);

        return new ReportSummaryResponse(
                from, to, today,
                farmSummary, salesReport, purchasesReport, inventoryReport,
                harvestReport, growthReport, internalStockReport, activityReport
        );
    }

    private List<ActivityRow> buildActivityFeed(
            List<SalesOrder> sales,
            List<PurchaseInvoice> purchases,
            List<InternalStockVoucher> vouchers,
            LocalDate from,
            LocalDate to
    ) {
        List<ActivityRow> feed = new ArrayList<>();

        for (SalesOrder o : sales) {
            LocalDateTime ts = o.getCreatedAt() != null ? o.getCreatedAt()
                    : (o.getDate() != null ? o.getDate().atTime(14, 0) : LocalDateTime.now(VN_ZONE));
            String detail = "Bán " + o.getQuantity() + " con (" + nz(o.getTotalWeight()).stripTrailingZeros().toPlainString()
                    + " kg) cho " + nonBlank(o.getCustomer(), "Khách lẻ")
                    + " · " + VN_NUMBER.format(nz(o.getTotalAmount()).longValue()) + " đ";
            feed.add(new ActivityRow("sale-" + o.getId(), ts, o.getDate(), "Quản lý bán hàng", "Bán hàng", "Xuất bán gà", detail, o.getCode()));
        }

        for (PurchaseInvoice p : purchases) {
            LocalDateTime ts = p.getCreatedAt() != null ? p.getCreatedAt()
                    : (p.getInvoiceDate() != null ? p.getInvoiceDate().atTime(10, 0) : LocalDateTime.now(VN_ZONE));
            String sup = p.getSupplier() != null ? p.getSupplier().getName() : "Nhà cung cấp";
            String detail = "Hóa đơn từ " + sup + " · "
                    + VN_NUMBER.format(p.getTotalAmount() != null ? p.getTotalAmount() : 0L) + " đ (" + p.getStockStatus() + ")";
            feed.add(new ActivityRow("po-" + p.getId(), ts, p.getInvoiceDate(), "Kế toán / Kho", "Nhập hàng", "Hóa đơn nhập", detail, p.getCode()));
        }

        for (InternalStockVoucher v : vouchers) {
            LocalDateTime ts = v.getCreatedAt() != null ? v.getCreatedAt()
                    : (v.getMovementDate() != null ? v.getMovementDate().atTime(9, 0) : LocalDateTime.now(VN_ZONE));
            String action = "TRANSFER".equalsIgnoreCase(v.getMovementType()) ? "Chuyển kho" : "Xuất kho nội bộ";
            String src = v.getSourceWarehouse() != null ? v.getSourceWarehouse().getName() : "Kho";
            String dst = v.getTargetWarehouse() != null ? v.getTargetWarehouse().getName()
                    : (v.getCycle() != null && v.getCycle().getBarn() != null ? v.getCycle().getBarn().getName() : "Chuồng nuôi");
            String detail = src + " -> " + dst + " (" + VN_NUMBER.format(nz(v.getTotalAmount()).longValue()) + " đ)";
            feed.add(new ActivityRow("iv-" + v.getId(), ts, v.getMovementDate(), nonBlank(v.getCreatedBy(), "Thủ kho"), "Xuất nhập nội bộ", action, detail, v.getCode()));
        }

        List<DailyTaskLog> taskLogs = dailyTaskLogRepository.findTop60ByOrderByDoneAtDescIdDesc();
        for (DailyTaskLog log : taskLogs) {
            if (!inDateRange(log.getTaskDate(), from, to)) continue;
            String barnName = log.getCycle() != null && log.getCycle().getBarn() != null
                    ? log.getCycle().getBarn().getName() : "Chuồng";
            String qty = log.getActualQuantity() != null
                    ? " · Thực tế: " + log.getActualQuantity().stripTrailingZeros().toPlainString()
                      + (log.getUsageUnit() != null ? " " + log.getUsageUnit().name().toLowerCase(Locale.ROOT) : "")
                    : "";
            String detail = barnName + " · " + log.getTaskName() + qty;
            feed.add(new ActivityRow(
                    "task-" + log.getId(), log.getDoneAt(), log.getTaskDate(),
                    nonBlank(log.getDoneBy(), "Công nhân"), "Ghi nhật ký", "Xác nhận việc", detail,
                    log.getCycle() != null ? CycleService.cycleCode(log.getCycle()) : ""
            ));
        }

        return feed.stream()
                .sorted(Comparator.comparing(ActivityRow::timestamp, Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(80)
                .toList();
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

    private static boolean inDateRange(LocalDate date, LocalDate from, LocalDate to) {
        if (from == null && to == null) return true;
        if (date == null) return false;
        if (from != null && date.isBefore(from)) return false;
        if (to != null && date.isAfter(to)) return false;
        return true;
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

