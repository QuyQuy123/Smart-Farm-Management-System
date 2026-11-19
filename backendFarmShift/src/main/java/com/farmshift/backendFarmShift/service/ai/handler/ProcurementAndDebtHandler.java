package com.farmshift.backendFarmShift.service.ai.handler;

import com.farmshift.backendFarmShift.dto.AiAssistantResponse;
import com.farmshift.backendFarmShift.dto.response.ReportSummaryResponse;
import com.farmshift.backendFarmShift.entity.PurchaseInvoice;
import com.farmshift.backendFarmShift.entity.Supplier;
import com.farmshift.backendFarmShift.repository.PurchaseInvoiceRepository;
import com.farmshift.backendFarmShift.repository.SupplierRepository;
import com.farmshift.backendFarmShift.service.ReportService;
import com.farmshift.backendFarmShift.service.VietnameseSpeechNormalizer;
import com.farmshift.backendFarmShift.service.ai.AiRbacPolicy;
import com.farmshift.backendFarmShift.service.ai.AssistantCommandHandler;
import com.farmshift.backendFarmShift.service.ai.AssistantExecutionContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.util.List;
import java.util.Locale;

/**
 * Handles Procurement, Supplier Debt (openingDebt + unpaid PurchaseInvoices), and Financial/WIP report queries.
 * Strict RBAC: Workers are blocked from debt payments or viewing financial debt/profit/WIP totals (MSG60).
 */
@Slf4j
@Component
@Order(40)
@RequiredArgsConstructor
public class ProcurementAndDebtHandler implements AssistantCommandHandler {

    private final SupplierRepository supplierRepository;
    private static final NumberFormat CURRENCY_FORMAT = NumberFormat.getInstance(Locale.forLanguageTag("vi-VN"));

    @Autowired(required = false)
    private PurchaseInvoiceRepository invoiceRepository;

    @Autowired(required = false)
    private ReportService reportService;

    @Override
    public int getOrder() {
        return 40;
    }

    @Override
    public boolean canHandle(AssistantExecutionContext context) {
        String msg = context.getMessage();
        if (msg == null || msg.isBlank()) return false;
        String norm = VietnameseSpeechNormalizer.removeVietnameseDiacritics(msg).toLowerCase(Locale.ROOT);

        boolean isSupplierDebt = (norm.contains("cong no") || norm.contains("no nha cung cap") || norm.contains("tra no") || norm.contains("thanh toan no"))
                && (norm.contains("nha cung cap") || norm.contains("dabaco") || norm.contains("cargill") || norm.contains("cp") || norm.contains("hanvet") || norm.contains("bao nhieu"));

        boolean isProfitOrWip = norm.contains("lai lo") || norm.contains("loi nhuan") || norm.contains("chi phi do dang")
                || norm.contains("do dang") || norm.contains("wip");

        return isSupplierDebt || isProfitOrWip;
    }

    @Override
    public AiAssistantResponse handle(AssistantExecutionContext context) {
        String msg = context.getMessage();
        String norm = VietnameseSpeechNormalizer.removeVietnameseDiacritics(msg).toLowerCase(Locale.ROOT);

        if (norm.contains("lai lo") || norm.contains("loi nhuan") || norm.contains("chi phi do dang")
                || norm.contains("do dang") || norm.contains("wip")) {
            return handleProfitAndWipQuery(context);
        }

        boolean isPayment = norm.contains("tra no") || norm.contains("thanh toan no") || norm.contains("thanh toan");
        if (isPayment && context.isWorker()) {
            return AiRbacPolicy.createForbiddenResponse();
        }

        List<Supplier> suppliers = supplierRepository.findAll();
        Supplier targetSupplier = suppliers.stream()
                .filter(s -> s.getName() != null && norm.contains(VietnameseSpeechNormalizer.removeVietnameseDiacritics(s.getName()).toLowerCase(Locale.ROOT)))
                .findFirst()
                .orElse(null);

        if (targetSupplier != null) {
            if (context.isWorker()) {
                return AiRbacPolicy.createForbiddenResponse();
            }

            long opening = targetSupplier.getOpeningDebt() != null ? targetSupplier.getOpeningDebt() : 0L;
            long invoiceDebt = 0L;
            if (invoiceRepository != null) {
                for (PurchaseInvoice inv : invoiceRepository.findBySupplier_IdOrderByInvoiceDateDescIdDesc(targetSupplier.getId())) {
                    if (!"Đã hủy".equalsIgnoreCase(inv.getStockStatus())) {
                        long tot = inv.getTotalAmount() != null ? inv.getTotalAmount() : 0L;
                        long pd = inv.getPaidAmount() != null ? inv.getPaidAmount() : 0L;
                        invoiceDebt += Math.max(0L, tot - pd);
                    }
                }
            }
            long totalDebt = Math.max(0L, opening + invoiceDebt);

            return AiAssistantResponse.builder()
                    .reply("📊 Hiện tại tổng công nợ đối với nhà cung cấp **" + targetSupplier.getName() + "** là **"
                            + CURRENCY_FORMAT.format(totalDebt) + " VNĐ** (nợ đầu kỳ: "
                            + CURRENCY_FORMAT.format(opening) + " VNĐ, nợ hóa đơn chưa thanh toán: "
                            + CURRENCY_FORMAT.format(invoiceDebt) + " VNĐ).")
                    .actionType("QUERY_SUPPLIER_DEBT")
                    .executed(true)
                    .navigateTo("/purchases")
                    .build();
        }

        return null;
    }

    private AiAssistantResponse handleProfitAndWipQuery(AssistantExecutionContext context) {
        if (context.isWorker()) {
            return AiRbacPolicy.createForbiddenResponse();
        }
        if (reportService == null) {
            return null;
        }

        ReportSummaryResponse.FarmSummary fs = reportService.getSummary(null, null).farmSummary();
        if (fs == null) {
            return AiAssistantResponse.builder()
                    .reply("ℹ️ Hiện chưa có dữ liệu lứa nuôi để tổng hợp lãi/lỗ.")
                    .actionType("QUERY_FARM_STATUS")
                    .executed(false)
                    .navigateTo("/reports")
                    .build();
        }

        BigDecimal realized = fs.realizedProfit() != null ? fs.realizedProfit() : BigDecimal.ZERO;
        BigDecimal wipCost = fs.wipCost() != null ? fs.wipCost() : BigDecimal.ZERO;
        BigDecimal wipRevenue = fs.wipRevenue() != null ? fs.wipRevenue() : BigDecimal.ZERO;
        BigDecimal totalRevenue = fs.totalRevenue() != null ? fs.totalRevenue() : BigDecimal.ZERO;
        BigDecimal totalCost = fs.totalCost() != null ? fs.totalCost() : BigDecimal.ZERO;

        String reply = "📊 **Tổng hợp Tài chính & Chi phí dở dang (8 Tab Báo cáo):**\n"
                + "- **Lãi/Lỗ đã chốt (lứa `CLOSED` - " + fs.closedCycles() + " lứa):** **" + CURRENCY_FORMAT.format(realized) + " VNĐ**\n"
                + "- **Chi phí dở dang đang nuôi (WIP `ACTIVE` - " + fs.activeBarns() + " chuồng):** **" + CURRENCY_FORMAT.format(wipCost) + " VNĐ**\n"
                + "- **Doanh thu tạm thu lứa đang nuôi (WIP):** **" + CURRENCY_FORMAT.format(wipRevenue) + " VNĐ**\n"
                + "- **Tổng doanh thu / Tổng chi phí lũy kế:** " + CURRENCY_FORMAT.format(totalRevenue) + " VNĐ / " + CURRENCY_FORMAT.format(totalCost) + " VNĐ.";

        return AiAssistantResponse.builder()
                .reply(reply)
                .actionType("QUERY_FARM_STATUS")
                .executed(true)
                .navigateTo("/reports")
                .build();
    }
}
