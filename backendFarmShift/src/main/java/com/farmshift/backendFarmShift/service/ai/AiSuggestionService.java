package com.farmshift.backendFarmShift.service.ai;

import com.farmshift.backendFarmShift.dto.AiSuggestionResponse;
import com.farmshift.backendFarmShift.dto.AiSuggestionResponse.SuggestionCard;
import com.farmshift.backendFarmShift.dto.response.BarnDayPlan;
import com.farmshift.backendFarmShift.dto.response.DebtSummaryResponse;
import com.farmshift.backendFarmShift.dto.response.WorkBoard;
import com.farmshift.backendFarmShift.entity.*;
import com.farmshift.backendFarmShift.repository.*;
import com.farmshift.backendFarmShift.security.RoleNames;
import com.farmshift.backendFarmShift.service.BarnResponsibilityService;
import com.farmshift.backendFarmShift.service.CycleService;
import com.farmshift.backendFarmShift.service.DailyPlanService;
import com.farmshift.backendFarmShift.service.DebtService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.NumberFormat;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Generates real-time, role-scoped and route-aware quick suggestion cards
 * for the FarmShift AI Chatbox directly from PostgreSQL operational state.
 * Strictly zero LLM calls, zero N+1 queries, VN_ZONE dates, BigDecimal math,
 * and MSG51/MSG60 RBAC enforcement for ROLE_FARM_WORKER.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AiSuggestionService {

    private static final int MAX_SUGGESTIONS = 4;
    private static final int ROUTE_BOOST_POINTS = 25;
    private static final int IOT_ROUTE_BOOST_POINTS = 80;
    private static final BigDecimal LOW_STOCK_THRESHOLD = new BigDecimal("5");
    private static final BigDecimal MORTALITY_RATE_ALERT = new BigDecimal("0.5");

    private static final Locale VI_LOCALE = Locale.forLanguageTag("vi-VN");

    private final DailyPlanService dailyPlanService;
    private final BarnResponsibilityService barnResponsibilityService;
    private final FarmingCycleRepository cycleRepository;
    private final FlockRepository flockRepository;
    private final FlockMovementRepository movementRepository;
    private final FeedRecordRepository feedRecordRepository;
    private final WeightSampleRepository weightSampleRepository;
    private final InventoryItemRepository inventoryItemRepository;
    private final PurchaseInvoiceRepository purchaseInvoiceRepository;
    private final DebtService debtService;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private BarnRepository barnRepository;

    public AiSuggestionResponse getSuggestions(
            String username,
            Collection<? extends GrantedAuthority> authorities,
            String rawRoute
    ) {
        String role = resolveRole(authorities);
        String roleLabel = resolveRoleLabel(role);
        String normalizedRoute = normalizeRoute(rawRoute);
        String routeLabel = resolveRouteLabel(normalizedRoute);

        LocalDate today = LocalDate.now(CycleService.VN_ZONE);
        LocalTime now = LocalTime.now(CycleService.VN_ZONE);

        List<SuggestionCard> candidates;
        String placeholder;

        switch (role) {
            case RoleNames.FARM_WORKER -> {
                candidates = buildWorkerCandidates(username, today, now);
                placeholder = "Hỏi hoặc ra lệnh: ghi cám, cân mẫu, hao hụt, việc hôm nay...";
            }
            case RoleNames.ACCOUNTANT -> {
                candidates = buildAccountantCandidates();
                placeholder = "Hỏi hoặc ra lệnh: nhập kho, công nợ NCC, tồn kho, chuyển kho...";
            }
            default -> {
                candidates = buildOwnerCandidates(today, now);
                placeholder = "Hỏi hoặc ra lệnh: FCR, lãi lỗ, công nợ, việc quá giờ, nhập kho...";
            }
        }

        List<SuggestionCard> ranked = rankAndSelect(candidates, normalizedRoute);

        return AiSuggestionResponse.builder()
                .role(role)
                .roleLabel(roleLabel)
                .routeLabel(routeLabel)
                .inputPlaceholder(placeholder)
                .generatedAt(OffsetDateTime.now(CycleService.VN_ZONE).format(DateTimeFormatter.ISO_OFFSET_DATE_TIME))
                .suggestions(ranked)
                .build();
    }

    // ------------------------------------------------------------------ Worker

    private List<SuggestionCard> buildWorkerCandidates(String username, LocalDate today, LocalTime now) {
        Set<Long> assignedBarnIds = username == null ? Set.of() : barnResponsibilityService.assignedBarnIdsOf(username);
        List<FarmingCycle> assignedCycles = assignedBarnIds.isEmpty()
                ? List.of()
                : cycleRepository.findAllWithBarnAndAreaForReport().stream()
                        .filter(c -> c.getStatus() == CycleStatus.ACTIVE
                                && c.getBarn() != null
                                && assignedBarnIds.contains(c.getBarn().getId()))
                        .toList();

        List<Long> cycleIds = assignedCycles.stream().map(FarmingCycle::getId).toList();
        CycleBatchData batch = loadCycleBatchData(cycleIds);

        List<BarnDayPlan> workerPlans = (username == null || username.isBlank())
                ? List.of()
                : dailyPlanService.farm(today, false, username, false);

        List<SuggestionCard> cards = new ArrayList<>();

        // 1. Overdue or remaining daily tasks in assigned barns
        TaskSignal taskSignal = summarizeTasks(workerPlans, now);
        if (taskSignal.overdueCount > 0) {
            cards.add(SuggestionCard.builder()
                    .id("worker_overdue_tasks")
                    .category("URGENT")
                    .badge("Quá giờ")
                    .title(taskSignal.topBarnName + ": " + taskSignal.overdueCount + " việc quá giờ")
                    .subtitle("Kiểm tra & xác nhận ngay trên phiếu việc hôm nay")
                    .prompt("Xem và xác nhận các việc quá giờ tại " + taskSignal.topBarnName)
                    .autoSend(true)
                    .targetRoute("/today-tasks")
                    .priorityScore(96)
                    .build());
        } else if (taskSignal.pendingCount > 0) {
            cards.add(SuggestionCard.builder()
                    .id("worker_pending_tasks")
                    .category("ACTION")
                    .badge("Việc hôm nay")
                    .title(taskSignal.topBarnName + ": còn " + taskSignal.pendingCount + " việc chưa xong")
                    .subtitle("Mở nhanh danh sách công việc trong ca")
                    .prompt("Liệt kê việc hôm nay chưa làm tại " + taskSignal.topBarnName)
                    .autoSend(true)
                    .targetRoute("/today-tasks")
                    .priorityScore(85)
                    .build());
        }

        // 2. Today's mortality alert inside assigned barns ONLY
        MortalitySignal mort = findWorstTodayMortality(assignedCycles, batch, today);
        if (mort != null) {
            cards.add(SuggestionCard.builder()
                    .id("worker_mortality_alert")
                    .category("URGENT")
                    .badge("Hao hụt")
                    .title(mort.barnName + ": hao hụt " + mort.lossToday + " con hôm nay")
                    .subtitle("Tỷ lệ " + mort.ratePct.stripTrailingZeros().toPlainString() + "% trong chuồng phụ trách")
                    .prompt("Kiểm tra tình trạng hao hụt hôm nay tại " + mort.barnName)
                    .autoSend(true)
                    .targetRoute("/journal")
                    .priorityScore(94)
                    .build());
        }

        // 3. Weight sample overdue (> 7 days since last weigh)
        WeightGapSignal weightGap = findMissingWeightSample(assignedCycles, batch, today);
        if (weightGap != null) {
            cards.add(SuggestionCard.builder()
                    .id("worker_weight_reminder")
                    .category("ALERT")
                    .badge("Cần cân mẫu")
                    .title(weightGap.barnName + ": chưa cân mẫu " + weightGap.daysLabel)
                    .subtitle("Chạm để điền trọng lượng trung bình mẫu 50 con")
                    .prompt("Cân mẫu " + weightGap.barnName + " trung bình ... kg mẫu 50 con")
                    .autoSend(false)
                    .targetRoute("/journal")
                    .priorityScore(80)
                    .build());
        }

        // 4. Operational quick templates scoped strictly to worker's assigned barns
        String primaryBarn = resolvePrimaryBarnName(assignedCycles, null);
        String targetBarnLabel = primaryBarn != null ? primaryBarn : "chuồng phụ trách";
        cards.add(SuggestionCard.builder()
                .id("worker_tpl_feed")
                .category("ACTION")
                .badge("Ghi cám")
                .title("Ghi nhật ký cho ăn" + (primaryBarn != null ? " · " + primaryBarn : ""))
                .subtitle("Điền nhanh khối lượng cám cho ăn hôm nay")
                .prompt("Ghi ... kg cám cho " + targetBarnLabel)
                .autoSend(false)
                .targetRoute("/journal")
                .priorityScore(66)
                .build());

        cards.add(SuggestionCard.builder()
                .id("worker_tpl_weight")
                .category("ACTION")
                .badge("Cân mẫu")
                .title("Báo cân mẫu" + (primaryBarn != null ? " · " + primaryBarn : ""))
                .subtitle("Điền trọng lượng bình quân đàn đang nuôi")
                .prompt("Cân mẫu " + targetBarnLabel + " trung bình ... kg mẫu 50 con")
                .autoSend(false)
                .targetRoute("/journal")
                .priorityScore(58)
                .build());

        cards.add(SuggestionCard.builder()
                .id("worker_today_summary")
                .category("INSIGHT")
                .badge("Lịch ca")
                .title("Xem việc hôm nay tại chuồng phụ trách")
                .subtitle("Tổng hợp cữ cám, thuốc, vắc-xin trong ngày")
                .prompt("Việc hôm nay tại các chuồng tôi phụ trách")
                .autoSend(true)
                .targetRoute("/today-tasks")
                .priorityScore(50)
                .build());

        cards.add(SuggestionCard.builder()
                .id("worker_vet_check")
                .category("INSIGHT")
                .badge("Thú y")
                .title("Hỏi chẩn đoán triệu chứng đàn")
                .subtitle("Nhập biểu hiện lâm sàng để tra cứu phác đồ")
                .prompt("Gà ở " + (primaryBarn != null ? primaryBarn : "chuồng") + " có dấu hiệu ... cần xử lý thế nào?")
                .autoSend(false)
                .targetRoute("/journal")
                .priorityScore(42)
                .build());

        return cards;
    }

    // -------------------------------------------------------------- Accountant

    private List<SuggestionCard> buildAccountantCandidates() {
        List<SuggestionCard> cards = new ArrayList<>();

        List<PurchaseInvoice> activeInvoices = purchaseInvoiceRepository.findByStockStatusNot("Đã hủy");
        List<PurchaseInvoice> pendingImport = activeInvoices.stream()
                .filter(inv -> inv.getFlock() == null
                        && !"Đã nhập kho".equalsIgnoreCase(inv.getStockStatus())
                        && !"Đã nhập chuồng".equalsIgnoreCase(inv.getStockStatus()))
                .toList();

        if (!pendingImport.isEmpty()) {
            PurchaseInvoice latest = pendingImport.get(0);
            String supplierName = latest.getSupplier() != null ? latest.getSupplier().getName() : "NCC";
            cards.add(SuggestionCard.builder()
                    .id("acc_pending_import_invoices")
                    .category("ALERT")
                    .badge("Chưa nhập kho")
                    .title(pendingImport.size() + " hóa đơn chờ nhập kho")
                    .subtitle("Gần nhất: " + safeStr(latest.getCode(), "HĐ") + " · " + supplierName)
                    .prompt("Kiểm tra các hóa đơn chưa nhập kho và hỗ trợ nhập kho")
                    .autoSend(true)
                    .targetRoute("/purchases")
                    .priorityScore(92)
                    .build());
        }

        DebtSummaryResponse debtSummary = debtService.getDebtSummary();
        if (debtSummary.totalSupplierPayable() > 0) {
            cards.add(SuggestionCard.builder()
                    .id("acc_supplier_debt")
                    .category("ALERT")
                    .badge("Công nợ NCC")
                    .title(debtSummary.unpaidPurchaseInvoiceCount() + " hóa đơn còn nợ " + formatVnd(debtSummary.totalSupplierPayable()))
                    .subtitle(debtSummary.unpaidSupplierCount() + " nhà cung cấp đang có số dư công nợ")
                    .prompt("Tổng hợp chi tiết công nợ nhà cung cấp cần thanh toán")
                    .autoSend(true)
                    .targetRoute("/purchases")
                    .priorityScore(88)
                    .build());
        }

        if (debtSummary.totalCustomerReceivable() != null && debtSummary.totalCustomerReceivable().signum() > 0) {
            cards.add(SuggestionCard.builder()
                    .id("acc_customer_receivable")
                    .category("INSIGHT")
                    .badge("Phải thu")
                    .title("Công nợ khách hàng: " + formatVnd(debtSummary.totalCustomerReceivable().longValue()))
                    .subtitle(debtSummary.unpaidSalesOrderCount() + " đơn xuất bán chưa thu đủ")
                    .prompt("Kiểm tra công nợ phải thu khách hàng hiện tại")
                    .autoSend(true)
                    .targetRoute("/sales")
                    .priorityScore(76)
                    .build());
        }

        LowStockSignal lowStock = summarizeLowStock(inventoryItemRepository.findAllForReport());
        if (lowStock.lowLotCount > 0) {
            cards.add(SuggestionCard.builder()
                    .id("acc_low_stock")
                    .category("ALERT")
                    .badge("Tồn kho thấp")
                    .title(lowStock.lowLotCount + " mặt hàng sắp hết (≤ 5 đơn vị)")
                    .subtitle("Ưu tiên: " + lowStock.sampleProductName + " · " + lowStock.sampleWarehouseName)
                    .prompt("Kiểm tra tồn kho thấp và giá trung bình các kho")
                    .autoSend(true)
                    .targetRoute("/inventory")
                    .priorityScore(84)
                    .build());
        }

        cards.add(SuggestionCard.builder()
                .id("acc_tpl_transfer")
                .category("ACTION")
                .badge("Chuyển kho")
                .title("Tạo phiếu xuất / chuyển kho nội bộ")
                .subtitle("Điền nhanh số lượng và mặt hàng cần điều chuyển")
                .prompt("Chuyển ... bao cám từ Kho tổng sang Kho khu nuôi")
                .autoSend(false)
                .targetRoute("/internal-stock")
                .priorityScore(64)
                .build());

        cards.add(SuggestionCard.builder()
                .id("acc_ocr_shortcut")
                .category("ACTION")
                .badge("AI OCR")
                .title("Quét hóa đơn nhập hàng (AI OCR)")
                .subtitle("Mở công cụ bóc tách ảnh / PDF hóa đơn thành phiếu nháp")
                .prompt("Quét hóa đơn OCR")
                .autoSend(true)
                .targetRoute("/purchases")
                .priorityScore(56)
                .build());

        cards.add(SuggestionCard.builder()
                .id("acc_financial_report")
                .category("INSIGHT")
                .badge("Đối soát")
                .title("Kiểm tra tồn kho & giá bình quân")
                .subtitle("Tổng hợp giá trị hàng tồn theo từng kho")
                .prompt("Kiểm tra tồn kho và giá trung bình hiện tại")
                .autoSend(true)
                .targetRoute("/inventory")
                .priorityScore(48)
                .build());

        cards.add(SuggestionCard.builder()
                .id("acc_debt_check")
                .category("INSIGHT")
                .badge("Báo cáo")
                .title("Tổng hợp công nợ & chi phí trang trại")
                .subtitle("Xem bức tranh chi phí mua hàng và phải trả")
                .prompt("Báo cáo chi phí, doanh thu và công nợ trang trại")
                .autoSend(true)
                .targetRoute("/reports")
                .priorityScore(42)
                .build());

        return cards;
    }

    // ------------------------------------------------------------------ Owner

    private List<SuggestionCard> buildOwnerCandidates(LocalDate today, LocalTime now) {
        List<FarmingCycle> activeCycles = cycleRepository.findAllWithBarnAndAreaForReport().stream()
                .filter(c -> c.getStatus() == CycleStatus.ACTIVE && c.getBarn() != null)
                .toList();
        List<Long> cycleIds = activeCycles.stream().map(FarmingCycle::getId).toList();
        CycleBatchData batch = loadCycleBatchData(cycleIds);
        List<BarnDayPlan> allPlans = dailyPlanService.farm(today, true, null, false);

        List<SuggestionCard> cards = new ArrayList<>();

        // 1. Today's mortality spike
        MortalitySignal mort = findWorstTodayMortality(activeCycles, batch, today);
        if (mort != null) {
            cards.add(SuggestionCard.builder()
                    .id("owner_mortality_alert")
                    .category("URGENT")
                    .badge("Hao hụt cao")
                    .title(mort.barnName + ": hao hụt " + mort.lossToday + " con hôm nay")
                    .subtitle("Tỷ lệ " + mort.ratePct.stripTrailingZeros().toPlainString() + "% · Cần kiểm tra đàn ngay")
                    .prompt("Phân tích tình trạng hao hụt và triệu chứng tại " + mort.barnName)
                    .autoSend(true)
                    .targetRoute("/journal")
                    .priorityScore(98)
                    .build());
        }

        // 2. Overdue tasks across farm
        TaskSignal taskSignal = summarizeTasks(allPlans, now);
        if (taskSignal.overdueCount > 0) {
            cards.add(SuggestionCard.builder()
                    .id("owner_overdue_tasks")
                    .category("URGENT")
                    .badge("Quá giờ")
                    .title(taskSignal.topBarnName + ": " + taskSignal.overdueCount + " việc quá giờ")
                    .subtitle("Tổng " + taskSignal.totalOverdue + " việc trễ lịch trên toàn trại")
                    .prompt("Xem các việc quá giờ hôm nay và phân công xử lý")
                    .autoSend(true)
                    .targetRoute("/today-tasks")
                    .priorityScore(95)
                    .build());
        } else if (taskSignal.pendingCount > 0) {
            cards.add(SuggestionCard.builder()
                    .id("owner_pending_tasks")
                    .category("ACTION")
                    .badge("Tiến độ ca")
                    .title("Còn " + taskSignal.pendingCount + " việc hôm nay chưa hoàn thành")
                    .subtitle("Chuồng nhiều việc nhất: " + taskSignal.topBarnName)
                    .prompt("Tóm tắt tiến độ công việc hôm nay của các chuồng")
                    .autoSend(true)
                    .targetRoute("/today-tasks")
                    .priorityScore(72)
                    .build());
        }

        // 3. 3-stage FCR anomaly across active cycles
        FcrAnomalySignal fcrSignal = findWorstFcrAnomaly(activeCycles, batch, today);
        if (fcrSignal != null) {
            cards.add(SuggestionCard.builder()
                    .id("owner_fcr_alert")
                    .category("ALERT")
                    .badge("Cảnh báo FCR")
                    .title(fcrSignal.barnName + ": FCR " + fcrSignal.fcr + " (chuẩn ≤ " + fcrSignal.maxBenchmark + ")")
                    .subtitle(fcrSignal.stageLabel + " (" + fcrSignal.ageDays + " ngày tuổi)")
                    .prompt("Phân tích nguyên nhân FCR cao và đề xuất xử lý cho " + fcrSignal.barnName)
                    .autoSend(true)
                    .targetRoute("/reports")
                    .priorityScore(90)
                    .build());
        }

        // 4. Low stock across warehouses
        LowStockSignal lowStock = summarizeLowStock(inventoryItemRepository.findAllForReport());
        if (lowStock.lowLotCount > 0) {
            cards.add(SuggestionCard.builder()
                    .id("owner_low_stock")
                    .category("ALERT")
                    .badge("Tồn kho thấp")
                    .title(lowStock.lowLotCount + " lô hàng sắp cạn tồn kho")
                    .subtitle(lowStock.sampleProductName + " (" + lowStock.sampleWarehouseName + ")")
                    .prompt("Kiểm tra các mặt hàng sắp hết tồn kho và đề xuất nhập thêm")
                    .autoSend(true)
                    .targetRoute("/inventory")
                    .priorityScore(84)
                    .build());
        }

        // 5. Pending import invoices & supplier payables
        List<PurchaseInvoice> activeInvoices = purchaseInvoiceRepository.findByStockStatusNot("Đã hủy");
        long unimportedCount = activeInvoices.stream()
                .filter(inv -> inv.getFlock() == null
                        && !"Đã nhập kho".equalsIgnoreCase(inv.getStockStatus())
                        && !"Đã nhập chuồng".equalsIgnoreCase(inv.getStockStatus()))
                .count();
        if (unimportedCount > 0) {
            cards.add(SuggestionCard.builder()
                    .id("owner_unimported_invoices")
                    .category("ACTION")
                    .badge("Nhập kho")
                    .title(unimportedCount + " hóa đơn chưa nhập kho")
                    .subtitle("Kiểm tra & hoàn tất nhập lô vào kho khu nuôi")
                    .prompt("Kiểm tra danh sách hóa đơn chưa nhập kho")
                    .autoSend(true)
                    .targetRoute("/purchases")
                    .priorityScore(78)
                    .build());
        }

        DebtSummaryResponse debtSummary = debtService.getDebtSummary();
        if (debtSummary.totalSupplierPayable() > 0) {
            cards.add(SuggestionCard.builder()
                    .id("owner_supplier_debt")
                    .category("INSIGHT")
                    .badge("Công nợ NCC")
                    .title("Công nợ NCC: " + formatVnd(debtSummary.totalSupplierPayable()))
                    .subtitle(debtSummary.unpaidPurchaseInvoiceCount() + " hóa đơn chưa thanh toán đủ")
                    .prompt("Tổng hợp công nợ nhà cung cấp hiện tại")
                    .autoSend(true)
                    .targetRoute("/purchases")
                    .priorityScore(74)
                    .build());
        }

        // 6. Clean fallbacks & dedicated /iot contextual cards (so empty DB and /iot route deliver relevant cards)
        List<String> activeBarnNames = resolveDistinctBarnNames(activeCycles);
        String primaryBarn = activeBarnNames.isEmpty() ? "Nhà A1" : activeBarnNames.get(0);
        String secondaryBarn = activeBarnNames.size() > 1 ? activeBarnNames.get(1) : primaryBarn;
        cards.add(SuggestionCard.builder()
                .id("owner_profit_loss")
                .category("INSIGHT")
                .badge("Lãi / Lỗ")
                .title("Tổng hợp doanh thu & lãi lỗ lứa nuôi")
                .subtitle("Xem hiệu quả tài chính toàn trang trại")
                .prompt("Báo cáo lãi lỗ và chi phí các lứa nuôi hiện tại")
                .autoSend(true)
                .targetRoute("/reports")
                .priorityScore(60)
                .build());

        cards.add(SuggestionCard.builder()
                .id("owner_tpl_feed")
                .category("ACTION")
                .badge("Ghi cám")
                .title("Ghi nhanh khẩu phần cám · " + primaryBarn)
                .subtitle("Điền số lượng cám thực tế để tự trừ kho FIFO")
                .prompt("Ghi ... kg cám cho " + primaryBarn)
                .autoSend(false)
                .targetRoute("/journal")
                .priorityScore(52)
                .build());

        cards.add(SuggestionCard.builder()
                .id("owner_iot_status")
                .category("INSIGHT")
                .badge("Môi trường")
                .title("Kiểm tra nhiệt độ & độ ẩm · " + primaryBarn)
                .subtitle("Đọc thông số cảm biến ESP32 & ngưỡng an toàn (28–31°C)")
                .prompt("Kiểm tra nhiệt độ và độ ẩm tại " + primaryBarn)
                .autoSend(true)
                .targetRoute("/iot")
                .priorityScore(32)
                .build());

        cards.add(SuggestionCard.builder()
                .id("owner_iot_ventilation")
                .category("ACTION")
                .badge("Thông gió")
                .title("Kiểm tra quạt thông gió & làm mát · " + secondaryBarn)
                .subtitle("Rà soát relay quạt hút, giàn mát và khí độc NH3/CO2")
                .prompt("Kiểm tra cảm biến và quạt thông gió tại " + secondaryBarn)
                .autoSend(true)
                .targetRoute("/iot")
                .priorityScore(30)
                .build());

        cards.add(SuggestionCard.builder()
                .id("owner_iot_heat_threshold")
                .category("ALERT")
                .badge("Ngưỡng nhiệt")
                .title("Ngưỡng nhiệt cảnh báo & chống nóng")
                .subtitle("Xử lý khi cảm biến vượt ngưỡng, bật phun sương & quạt")
                .prompt("Biện pháp chống nóng và kiểm soát stress nhiệt cho đàn gà")
                .autoSend(true)
                .targetRoute("/iot")
                .priorityScore(28)
                .build());

        cards.add(SuggestionCard.builder()
                .id("owner_iot_camera_tpl")
                .category("ACTION")
                .badge("Camera QR")
                .title("Tra cứu cảm biến / Camera QR theo chuồng")
                .subtitle("Điền tên chuồng (vd: " + primaryBarn + ") để kiểm tra môi trường")
                .prompt("Kiểm tra nhiệt độ, độ ẩm và thông gió tại ...")
                .autoSend(false)
                .targetRoute("/iot")
                .priorityScore(26)
                .build());

        cards.add(SuggestionCard.builder()
                .id("owner_farm_overview")
                .category("INSIGHT")
                .badge("Tổng quan")
                .title("Tình hình hoạt động trang trại hôm nay")
                .subtitle("Tóm tắt đàn nuôi, việc trong ngày và cảnh báo")
                .prompt("Tóm tắt tình hình trang trại hôm nay")
                .autoSend(true)
                .targetRoute("/dashboard")
                .priorityScore(38)
                .build());

        return cards;
    }

    private List<String> resolveDistinctBarnNames(List<FarmingCycle> activeCycles) {
        LinkedHashSet<String> names = new LinkedHashSet<>();
        if (activeCycles != null) {
            for (FarmingCycle c : activeCycles) {
                if (c.getBarn() != null && c.getBarn().getName() != null && !c.getBarn().getName().isBlank()) {
                    names.add(c.getBarn().getName());
                }
            }
        }
        if (names.isEmpty() && barnRepository != null) {
            for (Barn b : barnRepository.findAllByOrderByCreatedAtAscIdAsc()) {
                if (b.getName() != null && !b.getName().isBlank()) {
                    names.add(b.getName());
                }
            }
        }
        return new ArrayList<>(names);
    }

    // -------------------------------------------------------------- Computation

    private CycleBatchData loadCycleBatchData(List<Long> cycleIds) {
        if (cycleIds == null || cycleIds.isEmpty()) {
            return new CycleBatchData(Map.of(), Map.of(), Map.of(), Map.of());
        }
        Map<Long, List<Flock>> flocksByCycle = new HashMap<>();
        for (Flock f : flockRepository.findByCycleIdInOrderByImportDateAscIdAsc(cycleIds)) {
            if (f.getCycle() != null) {
                flocksByCycle.computeIfAbsent(f.getCycle().getId(), k -> new ArrayList<>()).add(f);
            }
        }
        Map<Long, List<FlockMovement>> movementsByCycle = new HashMap<>();
        for (FlockMovement m : movementRepository.findByFlock_Cycle_IdInOrderByMovementDateAscIdAsc(cycleIds)) {
            if (m.getFlock() != null && m.getFlock().getCycle() != null) {
                movementsByCycle.computeIfAbsent(m.getFlock().getCycle().getId(), k -> new ArrayList<>()).add(m);
            }
        }
        Map<Long, List<FeedRecord>> feedsByCycle = new HashMap<>();
        for (FeedRecord fr : feedRecordRepository.findByCycleIdInOrderByRecordDateDescIdDesc(cycleIds)) {
            if (fr.getCycle() != null) {
                feedsByCycle.computeIfAbsent(fr.getCycle().getId(), k -> new ArrayList<>()).add(fr);
            }
        }
        Map<Long, List<WeightSample>> weightsByCycle = new HashMap<>();
        for (WeightSample ws : weightSampleRepository.findByCycleIdInOrderBySampleDateDescIdDesc(cycleIds)) {
            if (ws.getCycle() != null) {
                weightsByCycle.computeIfAbsent(ws.getCycle().getId(), k -> new ArrayList<>()).add(ws);
            }
        }
        return new CycleBatchData(flocksByCycle, movementsByCycle, feedsByCycle, weightsByCycle);
    }

    private TaskSignal summarizeTasks(List<BarnDayPlan> plans, LocalTime now) {
        int totalOverdue = 0;
        int totalPending = 0;
        String topOverdueBarn = null;
        int maxBarnOverdue = 0;
        String topPendingBarn = null;
        int maxBarnPending = 0;

        for (BarnDayPlan plan : plans) {
            int barnOverdue = 0;
            int barnPending = 0;
            if (plan.tasks() != null) {
                for (BarnDayPlan.Task t : plan.tasks()) {
                    if (t.done() != null) continue;
                    barnPending++;
                    LocalTime scheduled = parseLocalTime(t.time());
                    if (scheduled != null && scheduled.isBefore(now)) {
                        barnOverdue++;
                    }
                }
            }
            if (plan.assignedTasks() != null) {
                for (WorkBoard.AssignedTask t : plan.assignedTasks()) {
                    if (t.done() != null) continue;
                    barnPending++;
                    if (t.dueTime() != null && t.dueTime().isBefore(now)) {
                        barnOverdue++;
                    }
                }
            }
            totalOverdue += barnOverdue;
            totalPending += barnPending;
            if (barnOverdue > maxBarnOverdue) {
                maxBarnOverdue = barnOverdue;
                topOverdueBarn = plan.barnName();
            }
            if (barnPending > maxBarnPending) {
                maxBarnPending = barnPending;
                topPendingBarn = plan.barnName();
            }
        }
        if (totalOverdue > 0) {
            return new TaskSignal(maxBarnOverdue, totalOverdue, totalPending, topOverdueBarn != null ? topOverdueBarn : "Trang trại");
        }
        return new TaskSignal(0, 0, totalPending, topPendingBarn != null ? topPendingBarn : "Trang trại");
    }

    private MortalitySignal findWorstTodayMortality(List<FarmingCycle> cycles, CycleBatchData batch, LocalDate today) {
        MortalitySignal worst = null;
        for (FarmingCycle cycle : cycles) {
            List<Flock> flocks = batch.flocksByCycle.getOrDefault(cycle.getId(), List.of());
            List<FlockMovement> movements = batch.movementsByCycle.getOrDefault(cycle.getId(), List.of());
            int live = flocks.stream().mapToInt(Flock::getQuantity).sum();
            int lossToday = 0;
            for (FlockMovement m : movements) {
                if (today.equals(m.getMovementDate())
                        && (m.getType() == FlockMovementType.DEATH || m.getType() == FlockMovementType.CULL)) {
                    lossToday += m.getQuantity();
                }
            }
            if (lossToday <= 0) continue;
            int base = live + lossToday;
            BigDecimal ratePct = base > 0
                    ? BigDecimal.valueOf(lossToday).multiply(BigDecimal.valueOf(100))
                            .divide(BigDecimal.valueOf(base), 2, RoundingMode.HALF_UP)
                    : BigDecimal.ZERO;
            if (lossToday >= 5 || ratePct.compareTo(MORTALITY_RATE_ALERT) >= 0) {
                if (worst == null || ratePct.compareTo(worst.ratePct) > 0) {
                    worst = new MortalitySignal(cycle.getBarn().getName(), lossToday, ratePct);
                }
            }
        }
        return worst;
    }

    private WeightGapSignal findMissingWeightSample(List<FarmingCycle> cycles, CycleBatchData batch, LocalDate today) {
        for (FarmingCycle cycle : cycles) {
            List<Flock> flocks = batch.flocksByCycle.getOrDefault(cycle.getId(), List.of());
            int ageDays = resolveAgeDays(cycle, flocks, today);
            if (ageDays < 7) continue;
            List<WeightSample> samples = batch.weightsByCycle.getOrDefault(cycle.getId(), List.of());
            if (samples.isEmpty()) {
                return new WeightGapSignal(cycle.getBarn().getName(), "trong lứa (" + ageDays + " ngày tuổi)");
            }
            LocalDate latestSampleDate = samples.get(0).getSampleDate();
            long daysSince = latestSampleDate != null ? ChronoUnit.DAYS.between(latestSampleDate, today) : 99;
            if (daysSince >= 7) {
                return new WeightGapSignal(cycle.getBarn().getName(), daysSince + " ngày qua");
            }
        }
        return null;
    }

    private FcrAnomalySignal findWorstFcrAnomaly(List<FarmingCycle> cycles, CycleBatchData batch, LocalDate today) {
        FcrAnomalySignal worst = null;
        BigDecimal worstExcess = BigDecimal.ZERO;

        for (FarmingCycle cycle : cycles) {
            List<Flock> flocks = batch.flocksByCycle.getOrDefault(cycle.getId(), List.of());
            List<FlockMovement> movements = batch.movementsByCycle.getOrDefault(cycle.getId(), List.of());
            List<FeedRecord> feeds = batch.feedsByCycle.getOrDefault(cycle.getId(), List.of());
            List<WeightSample> samples = batch.weightsByCycle.getOrDefault(cycle.getId(), List.of());

            int live = flocks.stream().mapToInt(Flock::getQuantity).sum();
            if (live <= 0) continue;

            BigDecimal feedKg = feeds.stream()
                    .map(FeedRecord::getQuantityKg)
                    .filter(Objects::nonNull)
                    .reduce(nz(cycle.getCarriedFeedKg()), BigDecimal::add);
            if (feedKg.signum() <= 0) continue;

            BigDecimal avgWeight = samples.stream()
                    .filter(s -> s.getSampleDate() != null && !s.getSampleDate().isAfter(today))
                    .map(WeightSample::getAvgWeightKg)
                    .filter(Objects::nonNull)
                    .findFirst()
                    .orElse(null);
            if (avgWeight == null || avgWeight.signum() <= 0) continue;

            BigDecimal rawBiomass = avgWeight.multiply(BigDecimal.valueOf(live));
            BigDecimal inWeight = BigDecimal.ZERO;
            BigDecimal outWeight = BigDecimal.ZERO;
            for (FlockMovement m : movements) {
                BigDecimal w = nz(m.getWeightKg());
                if (m.getType() == FlockMovementType.IMPORT || m.getType() == FlockMovementType.TRANSFER_IN) {
                    inWeight = inWeight.add(w);
                } else if (m.getType() == FlockMovementType.CULL
                        || m.getType() == FlockMovementType.HARVEST
                        || m.getType() == FlockMovementType.TRANSFER_OUT) {
                    outWeight = outWeight.add(w);
                }
            }
            BigDecimal gain = rawBiomass.add(outWeight).subtract(inWeight).add(nz(cycle.getCarriedGainKg()));
            BigDecimal divisor = gain.signum() > 0 ? gain : rawBiomass;
            if (divisor.signum() <= 0) continue;

            BigDecimal fcr = feedKg.divide(divisor, 2, RoundingMode.HALF_UP);
            int ageDays = resolveAgeDays(cycle, flocks, today);

            boolean isMia = flocks.stream()
                    .map(Flock::getProgram)
                    .filter(Objects::nonNull)
                    .map(p -> (safeStr(p.getBreed(), "") + " " + safeStr(p.getName(), "")).toLowerCase(Locale.ROOT))
                    .anyMatch(name -> name.contains("mía") || name.contains("mia") || name.contains("gà ta") || name.contains("ga ta"));

            String stageLabel;
            BigDecimal maxBench;
            if (ageDays <= 21) {
                stageLabel = "Giai đoạn úm";
                maxBench = new BigDecimal("1.35");
            } else if (ageDays <= 50) {
                stageLabel = "Giai đoạn phát triển";
                maxBench = new BigDecimal("1.85");
            } else {
                stageLabel = "Giai đoạn vỗ béo";
                maxBench = isMia ? new BigDecimal("2.95") : new BigDecimal("2.45");
            }

            if (fcr.compareTo(maxBench) > 0) {
                BigDecimal excess = fcr.subtract(maxBench);
                if (worst == null || excess.compareTo(worstExcess) > 0) {
                    worstExcess = excess;
                    worst = new FcrAnomalySignal(
                            cycle.getBarn().getName(),
                            fcr.setScale(2, RoundingMode.HALF_UP).toPlainString(),
                            maxBench.toPlainString(),
                            stageLabel,
                            ageDays
                    );
                }
            }
        }
        return worst;
    }

    private LowStockSignal summarizeLowStock(List<InventoryItem> lots) {
        Map<String, AggregatedStock> byKey = new LinkedHashMap<>();
        for (InventoryItem item : lots) {
            if (item.getWarehouse() == null || item.getProduct() == null) continue;
            String key = item.getWarehouse().getId() + ":" + item.getProduct().getId();
            AggregatedStock acc = byKey.computeIfAbsent(key, k -> new AggregatedStock(
                    item.getProduct().getName(),
                    item.getWarehouse().getName(),
                    BigDecimal.ZERO
            ));
            acc.total = acc.total.add(nz(item.getStock()));
        }
        int lowCount = 0;
        String sampleProduct = null;
        String sampleWarehouse = null;
        BigDecimal lowest = null;
        for (AggregatedStock acc : byKey.values()) {
            if (acc.total.compareTo(LOW_STOCK_THRESHOLD) <= 0) {
                lowCount++;
                if (lowest == null || acc.total.compareTo(lowest) < 0) {
                    lowest = acc.total;
                    sampleProduct = acc.productName;
                    sampleWarehouse = acc.warehouseName;
                }
            }
        }
        return new LowStockSignal(lowCount, sampleProduct, sampleWarehouse);
    }

    // -------------------------------------------------------------- Ranking & Routes

    private List<SuggestionCard> rankAndSelect(List<SuggestionCard> candidates, String normalizedRoute) {
        Map<String, SuggestionCard> deduped = new LinkedHashMap<>();
        for (SuggestionCard card : candidates) {
            if (card == null || card.getId() == null) continue;
            int boostedScore = card.getPriorityScore();
            if (matchesRouteContext(normalizedRoute, card.getTargetRoute())) {
                int boost = "/iot".equals(normalizedRoute) && "/iot".equals(normalizeRoute(card.getTargetRoute()))
                        ? IOT_ROUTE_BOOST_POINTS
                        : ROUTE_BOOST_POINTS;
                boostedScore += boost;
            }
            card.setPriorityScore(boostedScore);
            deduped.putIfAbsent(card.getId(), card);
        }

        List<SuggestionCard> list = new ArrayList<>(deduped.values());
        list.sort(Comparator.comparingInt(SuggestionCard::getPriorityScore).reversed());
        if (list.size() <= MAX_SUGGESTIONS) {
            return list;
        }
        List<SuggestionCard> top = new ArrayList<>(list.subList(0, MAX_SUGGESTIONS));
        boolean hasTemplateCard = top.stream().anyMatch(c -> !c.isAutoSend());
        if (!hasTemplateCard) {
            list.stream()
                    .skip(MAX_SUGGESTIONS)
                    .filter(c -> !c.isAutoSend())
                    .findFirst()
                    .ifPresent(templateCard -> top.set(MAX_SUGGESTIONS - 1, templateCard));
        }
        return List.copyOf(top);
    }

    private boolean matchesRouteContext(String currentRoute, String targetRoute) {
        if (currentRoute == null || targetRoute == null) return false;
        String cur = normalizeRoute(currentRoute);
        String tgt = normalizeRoute(targetRoute);
        if (cur.equals(tgt)) return true;
        if ("/barns".equals(cur) && ("/journal".equals(tgt) || "/today-tasks".equals(tgt))) return true;
        if ("/areas".equals(cur) && ("/barns".equals(tgt) || "/journal".equals(tgt))) return true;
        return "/dashboard".equals(cur) && "/today-tasks".equals(tgt);
    }

    static String normalizeRoute(String rawRoute) {
        if (rawRoute == null || rawRoute.isBlank()) return "/dashboard";
        String path = rawRoute.split("[?#]")[0].trim().toLowerCase(Locale.ROOT);
        if (path.endsWith("/") && path.length() > 1) {
            path = path.substring(0, path.length() - 1);
        }
        if (path.isEmpty() || "/".equals(path) || path.startsWith("/dashboard")) return "/dashboard";
        if (path.startsWith("/today-tasks")) return "/today-tasks";
        if (path.startsWith("/barns")) return "/barns";
        if (path.startsWith("/areas")) return "/areas";
        if (path.startsWith("/journal")) return "/journal";
        if (path.startsWith("/inventory")) return "/inventory";
        if (path.startsWith("/internal-stock") || path.startsWith("/transfers") || path.startsWith("/internal-transfers")) {
            return "/internal-stock";
        }
        if (path.startsWith("/purchases") || path.startsWith("/invoices")) return "/purchases";
        if (path.startsWith("/sales")) return "/sales";
        if (path.startsWith("/reports")) return "/reports";
        if (path.startsWith("/iot")) return "/iot";
        if (path.startsWith("/general-settings") || path.startsWith("/catalog-settings")
                || path.startsWith("/breeding-settings") || path.startsWith("/account")) {
            return "/general-settings";
        }
        return path;
    }

    private static String resolveRouteLabel(String normalizedRoute) {
        return switch (normalizedRoute) {
            case "/dashboard" -> "Bảng tin";
            case "/today-tasks" -> "Việc hôm nay";
            case "/barns" -> "Chuồng nuôi";
            case "/areas" -> "Khu nuôi";
            case "/journal" -> "Nhật ký nuôi";
            case "/inventory" -> "Tồn kho";
            case "/internal-stock" -> "Xuất nhập kho";
            case "/purchases" -> "Hóa đơn & Mua hàng";
            case "/sales" -> "Xuất bán";
            case "/reports" -> "Báo cáo";
            case "/iot" -> "Môi trường IoT";
            case "/general-settings" -> "Thiết lập";
            default -> "Trang trại";
        };
    }

    private static String resolveRole(Collection<? extends GrantedAuthority> authorities) {
        boolean isOwner = false;
        boolean isAccountant = false;
        boolean isWorker = false;
        if (authorities != null) {
            for (GrantedAuthority auth : authorities) {
                if (auth == null || auth.getAuthority() == null) continue;
                switch (auth.getAuthority()) {
                    case RoleNames.FARM_OWNER -> isOwner = true;
                    case RoleNames.ACCOUNTANT -> isAccountant = true;
                    case RoleNames.FARM_WORKER -> isWorker = true;
                    default -> { }
                }
            }
        }
        if (isOwner) return RoleNames.FARM_OWNER;
        if (isAccountant) return RoleNames.ACCOUNTANT;
        if (isWorker) return RoleNames.FARM_WORKER;
        return RoleNames.FARM_OWNER;
    }

    private static String resolveRoleLabel(String role) {
        return switch (role) {
            case RoleNames.ACCOUNTANT -> "Kế toán";
            case RoleNames.FARM_WORKER -> "Công nhân";
            default -> "Chủ trại";
        };
    }

    // -------------------------------------------------------------- Small Helpers

    private static int resolveAgeDays(FarmingCycle cycle, List<Flock> flocks, LocalDate today) {
        if (cycle.getHatchDate() != null) {
            return Math.max(1, (int) ChronoUnit.DAYS.between(cycle.getHatchDate(), today) + 1);
        }
        if (!flocks.isEmpty()) {
            Flock first = flocks.get(0);
            if (first.getImportDate() != null) {
                return Math.max(1, first.getAgeAtImport() + (int) ChronoUnit.DAYS.between(first.getImportDate(), today));
            }
        }
        if (cycle.getStartDate() != null) {
            return Math.max(1, (int) ChronoUnit.DAYS.between(cycle.getStartDate(), today) + 1 + cycle.getCarriedDays());
        }
        return 1;
    }

    private static String resolvePrimaryBarnName(List<FarmingCycle> cycles, String fallback) {
        for (FarmingCycle c : cycles) {
            if (c.getBarn() != null && c.getBarn().getName() != null && !c.getBarn().getName().isBlank()) {
                return c.getBarn().getName();
            }
        }
        return fallback;
    }

    private static LocalTime parseLocalTime(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            return LocalTime.parse(raw.trim());
        } catch (Exception ignored) {
            return null;
        }
    }

    private static String formatVnd(long amount) {
        return NumberFormat.getIntegerInstance(VI_LOCALE).format(Math.max(0L, amount)) + "đ";
    }

    private static String safeStr(String value, String fallback) {
        return (value == null || value.isBlank()) ? fallback : value;
    }

    private static BigDecimal nz(BigDecimal val) {
        return val == null ? BigDecimal.ZERO : val;
    }

    private record CycleBatchData(
            Map<Long, List<Flock>> flocksByCycle,
            Map<Long, List<FlockMovement>> movementsByCycle,
            Map<Long, List<FeedRecord>> feedsByCycle,
            Map<Long, List<WeightSample>> weightsByCycle
    ) { }

    private record TaskSignal(int overdueCount, int totalOverdue, int pendingCount, String topBarnName) { }

    private record MortalitySignal(String barnName, int lossToday, BigDecimal ratePct) { }

    private record WeightGapSignal(String barnName, String daysLabel) { }

    private record FcrAnomalySignal(String barnName, String fcr, String maxBenchmark, String stageLabel, int ageDays) { }

    private static final class AggregatedStock {
        final String productName;
        final String warehouseName;
        BigDecimal total;

        AggregatedStock(String productName, String warehouseName, BigDecimal total) {
            this.productName = productName;
            this.warehouseName = warehouseName;
            this.total = total;
        }
    }

    private record LowStockSignal(int lowLotCount, String sampleProductName, String sampleWarehouseName) { }
}
