package com.farmshift.backendFarmShift.service.ai.handler;

import com.farmshift.backendFarmShift.dto.AiAssistantResponse;
import com.farmshift.backendFarmShift.dto.response.DebtSummaryResponse;
import com.farmshift.backendFarmShift.dto.response.ReportSummaryResponse;
import com.farmshift.backendFarmShift.entity.PurchaseInvoice;
import com.farmshift.backendFarmShift.entity.SalesOrder;
import com.farmshift.backendFarmShift.entity.Supplier;
import com.farmshift.backendFarmShift.repository.PurchaseInvoiceRepository;
import com.farmshift.backendFarmShift.repository.SalesOrderRepository;
import com.farmshift.backendFarmShift.repository.SupplierRepository;
import com.farmshift.backendFarmShift.service.DebtService;
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
import java.util.regex.Pattern;

/**
 * Handles Procurement, Supplier Debt, Customer Receivables, and Financial/WIP report queries.
 * Strict RBAC: Workers are blocked from debt payments or viewing financial debt/profit/WIP totals (MSG60).
 */
@Slf4j
@Component
@Order(40)
@RequiredArgsConstructor
public class ProcurementAndDebtHandler implements AssistantCommandHandler {

    private final SupplierRepository supplierRepository;
    private static final ThreadLocal<NumberFormat> CURRENCY_FORMAT =
            ThreadLocal.withInitial(() -> NumberFormat.getInstance(Locale.forLanguageTag("vi-VN")));

    private static String formatCurrency(Object value) {
        return CURRENCY_FORMAT.get().format(value);
    }

    @Autowired(required = false)
    private PurchaseInvoiceRepository invoiceRepository;

    @Autowired(required = false)
    private ReportService reportService;

    @Autowired(required = false)
    private DebtService debtService;

    @Autowired(required = false)
    private SalesOrderRepository salesOrderRepository;

    @Override
    public int getOrder() {
        return 40;
    }

    @Override
    public boolean canHandle(AssistantExecutionContext context) {
        String msg = context.getMessage();
        if (msg == null || msg.isBlank()) return false;
        String norm = VietnameseSpeechNormalizer.removeVietnameseDiacritics(msg).toLowerCase(Locale.ROOT);

        boolean isSupplierDebt = (norm.contains("cong no") || norm.contains("con no") || norm.contains("dang no")
                || norm.contains("no nha cung cap") || norm.contains("no cong ty") || norm.contains("no ncc")
                || norm.contains("tra no") || norm.contains("thanh toan no"))
                && (norm.contains("nha cung cap") || norm.contains("cong ty") || norm.contains("ncc")
                || norm.contains("dabaco") || norm.contains("cargill") || norm.contains("cp") || norm.contains("c.p.")
                || norm.contains("hanvet") || norm.contains("xanh pon") || norm.contains("favet") || norm.contains("bao nhieu"));

        boolean isCustomerReceivable = norm.contains("phai thu")
                || ((norm.contains("cong no") || norm.contains("no ")) && (norm.contains("khach hang") || norm.contains("khach")));

        boolean isProfitOrWip = norm.contains("lai lo") || norm.contains("loi nhuan") || norm.contains("chi phi do dang")
                || norm.contains("do dang") || norm.contains("wip");

        return isSupplierDebt || isCustomerReceivable || isProfitOrWip;
    }

    @Override
    public AiAssistantResponse handle(AssistantExecutionContext context) {
        String msg = context.getMessage();
        String norm = VietnameseSpeechNormalizer.removeVietnameseDiacritics(msg).toLowerCase(Locale.ROOT);

        if (norm.contains("lai lo") || norm.contains("loi nhuan") || norm.contains("chi phi do dang")
                || norm.contains("do dang") || norm.contains("wip")) {
            return handleProfitAndWipQuery(context, norm);
        }

        if (norm.contains("phai thu") || ((norm.contains("cong no") || norm.contains("no ")) && (norm.contains("khach hang") || norm.contains("khach")))) {
            return handleCustomerReceivablesQuery(context);
        }

        boolean isPayment = norm.contains("tra no") || norm.contains("thanh toan no") || norm.contains("thanh toan");
        boolean mentionsSpecificInvoice = Pattern.compile("\\bnh\\s*[-_]?\\s*\\d+\\b").matcher(norm).find();
        if (isPayment && mentionsSpecificInvoice) {
            if (context.isWorker()) {
                return AiRbacPolicy.createForbiddenResponse();
            }
            return null;
        }

        List<Supplier> suppliers = supplierRepository.findAll();
        Supplier targetSupplier = suppliers.stream()
                .filter(s -> s.getName() != null && norm.contains(VietnameseSpeechNormalizer.removeVietnameseDiacritics(s.getName()).toLowerCase(Locale.ROOT)))
                .findFirst()
                .orElseGet(() -> suppliers.stream()
                        .filter(s -> {
                            if (s.getName() == null) return false;
                            String sNorm = VietnameseSpeechNormalizer.removeVietnameseDiacritics(s.getName()).toLowerCase(Locale.ROOT);
                            for (String kw : List.of("cargill", "c.p.", "dabaco", "xanh pon", "favet", "hanvet")) {
                                if (sNorm.contains(kw) && norm.contains(kw)) {
                                    return true;
                                }
                            }
                            return false;
                        })
                        .findFirst()
                        .orElse(null));

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
                            + formatCurrency(totalDebt) + " VNĐ** (nợ đầu kỳ: "
                            + formatCurrency(opening) + " VNĐ, nợ hóa đơn chưa thanh toán: "
                            + formatCurrency(invoiceDebt) + " VNĐ).")
                    .actionType("QUERY_SUPPLIER_DEBT")
                    .executed(true)
                    .navigateTo("/purchases")
                    .build();
        }

        return handleAllSuppliersDebtSummary(context);
    }

    private AiAssistantResponse handleAllSuppliersDebtSummary(AssistantExecutionContext context) {
        if (context.isWorker()) {
            return AiRbacPolicy.createForbiddenResponse();
        }

        if (debtService != null) {
            DebtSummaryResponse summary = debtService.getDebtSummary();
            long totalPayable = Math.max(0L, summary.totalSupplierPayable());
            StringBuilder sb = new StringBuilder("💳 **Tổng hợp Công nợ Phải trả Nhà cung cấp:**\n")
                    .append("- **Tổng công nợ cần thanh toán:** **")
                    .append(formatCurrency(totalPayable)).append(" VNĐ** (")
                    .append(summary.unpaidSupplierCount()).append(" nhà cung cấp / ")
                    .append(summary.unpaidPurchaseInvoiceCount()).append(" hóa đơn chưa thanh toán đủ)\n");

            if (summary.supplierPayables() != null) {
                for (DebtSummaryResponse.SupplierDebtRow row : summary.supplierPayables()) {
                    if (row.remainingDebt() > 0) {
                        sb.append("- **").append(row.supplierName()).append(":** còn nợ **")
                                .append(formatCurrency(row.remainingDebt())).append(" VNĐ** (")
                                .append(row.openInvoiceCount()).append(" hóa đơn chưa tất toán)\n");
                    }
                }
            }

            if (invoiceRepository != null) {
                List<PurchaseInvoice> unpaidInvoices = invoiceRepository.findByStockStatusNot("Đã hủy").stream()
                        .filter(inv -> {
                            long tot = inv.getTotalAmount() != null ? inv.getTotalAmount() : 0L;
                            long pd = inv.getPaidAmount() != null ? inv.getPaidAmount() : 0L;
                            return tot - pd > 0;
                        })
                        .toList();
                if (!unpaidInvoices.isEmpty()) {
                    sb.append("\n**Chi tiết hóa đơn nhập còn nợ:**\n");
                    for (PurchaseInvoice inv : unpaidInvoices) {
                        long tot = inv.getTotalAmount() != null ? inv.getTotalAmount() : 0L;
                        long pd = inv.getPaidAmount() != null ? inv.getPaidAmount() : 0L;
                        long rem = Math.max(0L, tot - pd);
                        String supName = inv.getSupplier() != null ? inv.getSupplier().getName() : "NCC";
                        boolean overdue = inv.getNote() != null
                                && VietnameseSpeechNormalizer.removeVietnameseDiacritics(inv.getNote()).toLowerCase(Locale.ROOT).contains("qua han");
                        sb.append("- `").append(inv.getCode()).append("` (").append(supName).append("): còn **")
                                .append(formatCurrency(rem)).append(" VNĐ**")
                                .append(overdue ? " ⚠️ **QUÁ HẠN**" : "").append("\n");
                    }
                }
            }

            return AiAssistantResponse.builder()
                    .reply(sb.toString().trim())
                    .actionType("QUERY_SUPPLIER_DEBT")
                    .executed(true)
                    .navigateTo("/purchases")
                    .build();
        }

        long totalDebt = 0L;
        if (invoiceRepository != null) {
            totalDebt += invoiceRepository.findByStockStatusNot("Đã hủy").stream()
                    .mapToLong(i -> Math.max(0L, (i.getTotalAmount() != null ? i.getTotalAmount() : 0L)
                            - (i.getPaidAmount() != null ? i.getPaidAmount() : 0L)))
                    .sum();
        }
        totalDebt += supplierRepository.findAll().stream()
                .mapToLong(s -> s.getOpeningDebt() != null ? s.getOpeningDebt() : 0L)
                .sum();

        return AiAssistantResponse.builder()
                .reply("💳 **Tổng công nợ phải trả nhà cung cấp hiện tại:** **" + formatCurrency(Math.max(0L, totalDebt)) + " VNĐ**.")
                .actionType("QUERY_SUPPLIER_DEBT")
                .executed(true)
                .navigateTo("/purchases")
                .build();
    }

    private AiAssistantResponse handleCustomerReceivablesQuery(AssistantExecutionContext context) {
        if (context.isWorker()) {
            return AiRbacPolicy.createForbiddenResponse();
        }
        if (debtService == null) {
            return null;
        }
        DebtSummaryResponse summary = debtService.getDebtSummary();
        BigDecimal totalReceivable = summary.totalCustomerReceivable() != null ? summary.totalCustomerReceivable() : BigDecimal.ZERO;

        StringBuilder sb = new StringBuilder("💰 **Tổng hợp Công nợ Phải thu Khách hàng:**\n")
                .append("- **Tổng phải thu hiện tại:** **")
                .append(formatCurrency(totalReceivable)).append(" VNĐ** (")
                .append(summary.unpaidCustomerCount()).append(" khách hàng / ")
                .append(summary.unpaidSalesOrderCount()).append(" đơn bán hàng chưa thu đủ).\n");

        if (summary.customerReceivables() != null) {
            for (DebtSummaryResponse.CustomerDebtRow row : summary.customerReceivables()) {
                if (row.remainingDebt() != null && row.remainingDebt().signum() > 0) {
                    sb.append("- **").append(row.customerName()).append(":** còn nợ **")
                            .append(formatCurrency(row.remainingDebt())).append(" VNĐ** (")
                            .append(row.openOrderCount()).append(" đơn chưa tất toán)\n");
                }
            }
        }
        if (salesOrderRepository != null) {
            List<SalesOrder> unpaidOrders = salesOrderRepository.findUnpaidOrders();
            if (!unpaidOrders.isEmpty()) {
                sb.append("\n**Chi tiết đơn bán còn công nợ:**\n");
                for (SalesOrder o : unpaidOrders) {
                    BigDecimal remain = o.getTotalAmount().subtract(o.getPaidAmount() != null ? o.getPaidAmount() : BigDecimal.ZERO);
                    boolean overdue = o.getNote() != null && VietnameseSpeechNormalizer.removeVietnameseDiacritics(o.getNote()).toLowerCase(Locale.ROOT).contains("qua han");
                    sb.append("- `").append(o.getCode()).append("` (").append(o.getCustomer()).append("): **")
                            .append(formatCurrency(remain)).append(" VNĐ**")
                            .append(overdue ? " ⚠️ **QUÁ HẠN**" : "").append("\n");
                }
            }
        }

        return AiAssistantResponse.builder()
                .reply(sb.toString().trim())
                .actionType("QUERY_CUSTOMER_DEBT")
                .executed(true)
                .navigateTo("/sales")
                .build();
    }

    private AiAssistantResponse handleProfitAndWipQuery(AssistantExecutionContext context, String norm) {
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

        StringBuilder sb = new StringBuilder("📊 **Tổng hợp Tài chính & Chi phí dở dang (8 Tab Báo cáo):**\n")
                .append("- **Lãi/Lỗ đã chốt (lứa `CLOSED` - ").append(fs.closedCycles()).append(" lứa):** **").append(formatCurrency(realized)).append(" VNĐ**\n")
                .append("- **Chi phí dở dang đang nuôi (WIP `ACTIVE` - ").append(fs.activeBarns()).append(" chuồng):** **").append(formatCurrency(wipCost)).append(" VNĐ**\n")
                .append("- **Doanh thu tạm thu lứa đang nuôi (WIP):** **").append(formatCurrency(wipRevenue)).append(" VNĐ**\n")
                .append("- **Tổng doanh thu / Tổng chi phí lũy kế:** ").append(formatCurrency(totalRevenue)).append(" VNĐ / ").append(formatCurrency(totalCost)).append(" VNĐ.");

        boolean asksDebt = norm != null && (norm.contains("cong no") || norm.contains("den han") || norm.contains("qua han")
                || norm.contains("phai tra") || norm.contains("phai thu") || norm.contains("no ncc"));
        if (asksDebt && debtService != null) {
            DebtSummaryResponse debt = debtService.getDebtSummary();
            sb.append("\n\n💳 **Công nợ hiện tại & đến hạn:**\n")
                    .append("- **Công nợ phải trả NCC:** **").append(formatCurrency(debt.totalSupplierPayable())).append(" VNĐ** (")
                    .append(debt.unpaidPurchaseInvoiceCount()).append(" hóa đơn chưa thanh toán đủ)\n");
            if (invoiceRepository != null) {
                for (PurchaseInvoice inv : invoiceRepository.findByStockStatusNot("Đã hủy")) {
                    long tot = inv.getTotalAmount() != null ? inv.getTotalAmount() : 0L;
                    long pd = inv.getPaidAmount() != null ? inv.getPaidAmount() : 0L;
                    long rem = Math.max(0L, tot - pd);
                    if (rem > 0) {
                        String sup = inv.getSupplier() != null ? inv.getSupplier().getName() : "NCC";
                        boolean overdue = inv.getNote() != null && VietnameseSpeechNormalizer.removeVietnameseDiacritics(inv.getNote()).toLowerCase(Locale.ROOT).contains("qua han");
                        sb.append("  • `").append(inv.getCode()).append("` (").append(sup).append("): còn **")
                                .append(formatCurrency(rem)).append(" VNĐ**")
                                .append(overdue ? " ⚠️ **QUÁ HẠN**" : "").append("\n");
                    }
                }
            }
            BigDecimal rec = debt.totalCustomerReceivable() != null ? debt.totalCustomerReceivable() : BigDecimal.ZERO;
            sb.append("- **Công nợ phải thu khách hàng:** **").append(formatCurrency(rec)).append(" VNĐ** (")
                    .append(debt.unpaidSalesOrderCount()).append(" đơn bán chưa thu đủ)");
        }

        return AiAssistantResponse.builder()
                .reply(sb.toString().trim())
                .actionType("QUERY_FARM_STATUS")
                .executed(true)
                .navigateTo("/reports")
                .build();
    }
}
