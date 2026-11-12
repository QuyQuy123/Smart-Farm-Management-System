package com.farmshift.backendFarmShift.service;

import com.farmshift.backendFarmShift.dto.response.DebtSummaryResponse;
import com.farmshift.backendFarmShift.dto.response.DebtSummaryResponse.CustomerDebtRow;
import com.farmshift.backendFarmShift.dto.response.DebtSummaryResponse.SupplierDebtRow;
import com.farmshift.backendFarmShift.dto.response.SupplierDebtHistoryResponse;
import com.farmshift.backendFarmShift.dto.response.SupplierDebtHistoryResponse.InvoiceBrief;
import com.farmshift.backendFarmShift.dto.response.SupplierDebtHistoryResponse.LedgerEntry;
import com.farmshift.backendFarmShift.dto.response.SupplierDebtHistoryResponse.PaymentEntry;
import com.farmshift.backendFarmShift.entity.CustomerContact;
import com.farmshift.backendFarmShift.entity.PurchaseInvoice;
import com.farmshift.backendFarmShift.entity.PurchasePayment;
import com.farmshift.backendFarmShift.entity.SalesOrder;
import com.farmshift.backendFarmShift.entity.Supplier;
import com.farmshift.backendFarmShift.exception.ResourceNotFoundException;
import com.farmshift.backendFarmShift.repository.CustomerContactRepository;
import com.farmshift.backendFarmShift.repository.PurchaseInvoiceRepository;
import com.farmshift.backendFarmShift.repository.PurchasePaymentRepository;
import com.farmshift.backendFarmShift.repository.SalesOrderRepository;
import com.farmshift.backendFarmShift.repository.SupplierRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DebtService {
    private final SupplierRepository supplierRepository;
    private final PurchaseInvoiceRepository invoiceRepository;
    private final PurchasePaymentRepository paymentRepository;
    private final CustomerContactRepository customerRepository;
    private final SalesOrderRepository salesOrderRepository;

    public DebtSummaryResponse getDebtSummary() {
        List<Supplier> suppliers = supplierRepository.findAll(Sort.by("name").ascending());
        List<PurchaseInvoice> activeInvoices = invoiceRepository.findByStockStatusNot("Đã hủy");

        Map<Long, List<PurchaseInvoice>> invoicesBySupplier = new HashMap<>();
        for (PurchaseInvoice inv : activeInvoices) {
            if (inv.getSupplier() != null) {
                invoicesBySupplier.computeIfAbsent(inv.getSupplier().getId(), k -> new ArrayList<>()).add(inv);
            }
        }

        long totalSupplierPayable = 0L;
        int unpaidSupplierCount = 0;
        int unpaidPurchaseInvoiceCount = 0;
        List<SupplierDebtRow> supplierRows = new ArrayList<>();

        for (Supplier s : suppliers) {
            long opening = s.getOpeningDebt() != null ? s.getOpeningDebt() : 0L;
            List<PurchaseInvoice> list = invoicesBySupplier.getOrDefault(s.getId(), List.of());
            long totalPurchased = 0L;
            long totalPaid = 0L;
            int openCount = 0;
            LocalDate lastDate = null;
            for (PurchaseInvoice inv : list) {
                long tot = inv.getTotalAmount() != null ? inv.getTotalAmount() : 0L;
                long paid = inv.getPaidAmount() != null ? inv.getPaidAmount() : 0L;
                totalPurchased += tot;
                totalPaid += paid;
                if (paid < tot) {
                    openCount++;
                }
                if (inv.getInvoiceDate() != null && (lastDate == null || inv.getInvoiceDate().isAfter(lastDate))) {
                    lastDate = inv.getInvoiceDate();
                }
            }
            long remaining = Math.max(0L, opening + totalPurchased - totalPaid);
            totalSupplierPayable += remaining;
            if (remaining > 0) unpaidSupplierCount++;
            unpaidPurchaseInvoiceCount += openCount;

            supplierRows.add(new SupplierDebtRow(
                    s.getId(),
                    s.getName(),
                    s.getProductType() != null ? s.getProductType().getName() : "",
                    s.getRepresentative(),
                    s.getPhone(),
                    s.getPaymentPolicy(),
                    opening,
                    totalPurchased,
                    totalPaid,
                    remaining,
                    openCount,
                    lastDate
            ));
        }

        supplierRows.sort(Comparator.comparingLong(SupplierDebtRow::remainingDebt).reversed()
                .thenComparing(SupplierDebtRow::supplierName, String.CASE_INSENSITIVE_ORDER));

        // Customer receivables from SalesOrders + CustomerContacts
        List<CustomerContact> customers = customerRepository.findAll(Sort.by("name").ascending());
        List<SalesOrder> orders = salesOrderRepository.findAll(Sort.by("date").descending());
        Map<Long, List<SalesOrder>> ordersByCustomer = new HashMap<>();
        List<SalesOrder> unmatchedOrders = new ArrayList<>();
        for (SalesOrder o : orders) {
            if (o.getBuyer() != null && o.getBuyer().getId() != null) {
                ordersByCustomer.computeIfAbsent(o.getBuyer().getId(), k -> new ArrayList<>()).add(o);
            } else {
                unmatchedOrders.add(o);
            }
        }

        BigDecimal totalCustomerReceivable = BigDecimal.ZERO;
        int unpaidCustomerCount = 0;
        int unpaidSalesOrderCount = 0;
        List<CustomerDebtRow> customerRows = new ArrayList<>();

        for (CustomerContact c : customers) {
            List<SalesOrder> list = ordersByCustomer.getOrDefault(c.getId(), List.of());
            BigDecimal bought = BigDecimal.ZERO;
            BigDecimal paid = BigDecimal.ZERO;
            int openCount = 0;
            LocalDate lastOrder = null;
            for (SalesOrder o : list) {
                BigDecimal tot = nz(o.getTotalAmount());
                BigDecimal pd = nz(o.getPaidAmount());
                bought = bought.add(tot);
                paid = paid.add(pd);
                if (tot.compareTo(pd) > 0) {
                    openCount++;
                }
                if (o.getDate() != null && (lastOrder == null || o.getDate().isAfter(lastOrder))) {
                    lastOrder = o.getDate();
                }
            }
            BigDecimal remaining = list.isEmpty() ? nz(c.getDebt()).max(BigDecimal.ZERO) : bought.subtract(paid).max(BigDecimal.ZERO);
            BigDecimal totalBought = list.isEmpty() ? nz(c.getTotalBought()) : bought;
            totalCustomerReceivable = totalCustomerReceivable.add(remaining);
            if (remaining.signum() > 0) unpaidCustomerCount++;
            unpaidSalesOrderCount += openCount;

            customerRows.add(new CustomerDebtRow(
                    c.getId(),
                    c.getName(),
                    c.getPhone(),
                    c.getAddress(),
                    totalBought,
                    paid,
                    remaining,
                    openCount,
                    lastOrder
            ));
        }

        if (!unmatchedOrders.isEmpty()) {
            BigDecimal orphanTotal = BigDecimal.ZERO;
            BigDecimal orphanPaid = BigDecimal.ZERO;
            int orphanOpen = 0;
            LocalDate lastOrphanDate = null;
            for (SalesOrder o : unmatchedOrders) {
                BigDecimal tot = nz(o.getTotalAmount());
                BigDecimal pd = nz(o.getPaidAmount());
                orphanTotal = orphanTotal.add(tot);
                orphanPaid = orphanPaid.add(pd);
                if (tot.compareTo(pd) > 0) orphanOpen++;
                if (o.getDate() != null && (lastOrphanDate == null || o.getDate().isAfter(lastOrphanDate))) {
                    lastOrphanDate = o.getDate();
                }
            }
            BigDecimal orphanRem = orphanTotal.subtract(orphanPaid).max(BigDecimal.ZERO);
            if (orphanRem.signum() > 0 || orphanTotal.signum() > 0) {
                totalCustomerReceivable = totalCustomerReceivable.add(orphanRem);
                if (orphanRem.signum() > 0) unpaidCustomerCount++;
                unpaidSalesOrderCount += orphanOpen;
                customerRows.add(new CustomerDebtRow(
                        null,
                        "Khách lẻ khác",
                        "—",
                        "—",
                        orphanTotal,
                        orphanPaid,
                        orphanRem,
                        orphanOpen,
                        lastOrphanDate
                ));
            }
        }

        customerRows.sort((a, b) -> {
            int cmp = b.remainingDebt().compareTo(a.remainingDebt());
            if (cmp != 0) return cmp;
            return String.valueOf(a.customerName()).compareToIgnoreCase(String.valueOf(b.customerName()));
        });

        // Net position: Receivables - Payables (positive = net receivable, negative = net payable)
        BigDecimal netDebtPosition = totalCustomerReceivable.subtract(BigDecimal.valueOf(totalSupplierPayable));

        return new DebtSummaryResponse(
                totalSupplierPayable,
                unpaidSupplierCount,
                unpaidPurchaseInvoiceCount,
                totalCustomerReceivable,
                unpaidCustomerCount,
                unpaidSalesOrderCount,
                netDebtPosition,
                supplierRows,
                customerRows
        );
    }

    public SupplierDebtHistoryResponse getSupplierDebtHistory(Long supplierId) {
        Supplier supplier = supplierRepository.findById(supplierId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy nhà cung cấp."));

        List<PurchaseInvoice> allInvoices = invoiceRepository.findBySupplier_IdOrderByInvoiceDateDescIdDesc(supplierId)
                .stream()
                .filter(inv -> !"Đã hủy".equalsIgnoreCase(inv.getStockStatus()))
                .toList();
        List<PurchasePayment> payments = paymentRepository.findBySupplier_IdOrderByPaymentDateDescIdDesc(supplierId);

        long openingDebt = supplier.getOpeningDebt() != null ? supplier.getOpeningDebt() : 0L;
        long totalPurchased = 0L;
        long totalPaidFromInvoices = 0L;
        int openInvoices = 0;

        List<InvoiceBrief> invoiceBriefs = new ArrayList<>();
        for (PurchaseInvoice inv : allInvoices) {
            long tot = inv.getTotalAmount() != null ? inv.getTotalAmount() : 0L;
            long paid = inv.getPaidAmount() != null ? inv.getPaidAmount() : 0L;
            long debt = Math.max(0L, tot - paid);
            totalPurchased += tot;
            totalPaidFromInvoices += paid;
            if (debt > 0) openInvoices++;
            invoiceBriefs.add(new InvoiceBrief(
                    inv.getId(),
                    inv.getCode(),
                    inv.getInvoiceDate(),
                    tot,
                    paid,
                    debt,
                    inv.getPaymentStatus(),
                    inv.getStockStatus(),
                    inv.getReferenceCode(),
                    inv.getNote()
            ));
        }

        List<PaymentEntry> paymentEntries = payments.stream()
                .map(p -> new PaymentEntry(
                        p.getId(),
                        p.getInvoice().getId(),
                        p.getInvoice().getCode(),
                        p.getPaymentDate(),
                        p.getAmount(),
                        p.getPaymentMethod(),
                        p.getCashFundId(),
                        p.getNote(),
                        p.getCreatedBy(),
                        p.getCreatedAt()
                ))
                .toList();

        // Build unified chronological ledger to compute accurate running balance
        record RawEvent(String type, LocalDate date, int order, String code, String desc, long debit, long credit, Long invoiceId, String status) {}
        List<RawEvent> rawEvents = new ArrayList<>();
        if (openingDebt > 0) {
            LocalDate openDate = supplier.getCreatedAt() != null ? supplier.getCreatedAt().toLocalDate() : LocalDate.now();
            rawEvents.add(new RawEvent("OPENING_DEBT", openDate, 0, "DK", "Nợ đầu kỳ chuyển sang", openingDebt, 0L, null, "Đầu kỳ"));
        }
        for (PurchaseInvoice inv : allInvoices) {
            long tot = inv.getTotalAmount() != null ? inv.getTotalAmount() : 0L;
            rawEvents.add(new RawEvent("PURCHASE_INVOICE", inv.getInvoiceDate(), 1, inv.getCode(),
                    "Hóa đơn nhập hàng " + inv.getCode() + (inv.getReferenceCode() != null && !inv.getReferenceCode().isBlank() ? " (" + inv.getReferenceCode() + ")" : ""),
                    tot, 0L, inv.getId(), inv.getPaymentStatus()));
        }
        for (PurchasePayment p : payments) {
            rawEvents.add(new RawEvent("PAYMENT", p.getPaymentDate(), 2, p.getInvoice().getCode(),
                    p.getNote() != null && !p.getNote().isBlank() ? p.getNote() : "Thanh toán hóa đơn " + p.getInvoice().getCode(),
                    0L, p.getAmount(), p.getInvoice().getId(), p.getPaymentMethod()));
        }

        rawEvents.sort(Comparator.comparingInt((RawEvent e) -> "OPENING_DEBT".equals(e.type()) ? 0 : 1)
                .thenComparing(e -> e.date() != null ? e.date() : LocalDate.MIN)
                .thenComparingInt(RawEvent::order));

        long running = 0L;
        List<LedgerEntry> chronological = new ArrayList<>();
        for (RawEvent ev : rawEvents) {
            running = Math.max(0L, running + ev.debit() - ev.credit());
            chronological.add(new LedgerEntry(
                    ev.type(),
                    ev.date(),
                    ev.code(),
                    ev.desc(),
                    ev.debit(),
                    ev.credit(),
                    running,
                    ev.invoiceId(),
                    ev.status()
            ));
        }
        Collections.reverse(chronological);

        long currentDebt = Math.max(0L, openingDebt + totalPurchased - totalPaidFromInvoices);

        return new SupplierDebtHistoryResponse(
                supplier.getId(),
                supplier.getName(),
                supplier.getProductType() != null ? supplier.getProductType().getName() : "",
                supplier.getRepresentative(),
                supplier.getPhone(),
                supplier.getEmail(),
                supplier.getAddress(),
                supplier.getTaxCode(),
                supplier.getBankName(),
                supplier.getBankAccount(),
                supplier.getPaymentPolicy(),
                supplier.getNote(),
                openingDebt,
                totalPurchased,
                totalPaidFromInvoices,
                currentDebt,
                invoiceBriefs.size(),
                openInvoices,
                invoiceBriefs,
                paymentEntries,
                chronological
        );
    }

    private static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }
}

