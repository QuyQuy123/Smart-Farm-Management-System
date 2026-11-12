package com.farmshift.backendFarmShift.dto.response;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record SupplierDebtHistoryResponse(
        Long supplierId,
        String supplierName,
        String productTypeName,
        String representative,
        String phone,
        String email,
        String address,
        String taxCode,
        String bankName,
        String bankAccount,
        String paymentPolicy,
        String note,
        long openingDebt,
        long totalPurchased,
        long totalPaid,
        long currentDebt,
        int totalInvoices,
        int openInvoices,
        List<InvoiceBrief> invoices,
        List<PaymentEntry> payments,
        List<LedgerEntry> ledger
) {
    public record InvoiceBrief(
            Long id,
            String code,
            LocalDate date,
            long totalAmount,
            long paidAmount,
            long debtAmount,
            String paymentStatus,
            String stockStatus,
            String referenceCode,
            String note
    ) {
    }

    public record PaymentEntry(
            Long id,
            Long invoiceId,
            String invoiceCode,
            LocalDate paymentDate,
            long amount,
            String paymentMethod,
            Long cashFundId,
            String note,
            String createdBy,
            LocalDateTime createdAt
    ) {
    }

    /**
     * Unified chronological debt ledger entry combining OPENING_DEBT, PURCHASE_INVOICE (+) and PAYMENT (-).
     */
    public record LedgerEntry(
            String entryType,
            LocalDate date,
            String referenceCode,
            String description,
            long debitAmount,
            long creditAmount,
            long runningBalance,
            Long invoiceId,
            String paymentStatus
    ) {
    }
}

