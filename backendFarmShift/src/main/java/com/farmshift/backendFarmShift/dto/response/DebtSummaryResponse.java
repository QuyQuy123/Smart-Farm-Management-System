package com.farmshift.backendFarmShift.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record DebtSummaryResponse(
        long totalSupplierPayable,
        int unpaidSupplierCount,
        int unpaidPurchaseInvoiceCount,
        BigDecimal totalCustomerReceivable,
        int unpaidCustomerCount,
        int unpaidSalesOrderCount,
        BigDecimal netDebtPosition,
        List<SupplierDebtRow> supplierPayables,
        List<CustomerDebtRow> customerReceivables
) {
    public record SupplierDebtRow(
            Long supplierId,
            String supplierName,
            String productTypeName,
            String representative,
            String phone,
            String paymentPolicy,
            long openingDebt,
            long totalPurchased,
            long totalPaid,
            long remainingDebt,
            int openInvoiceCount,
            LocalDate lastInvoiceDate
    ) {
    }

    public record CustomerDebtRow(
            Long customerId,
            String customerName,
            String phone,
            String address,
            BigDecimal totalBought,
            BigDecimal totalPaid,
            BigDecimal remainingDebt,
            int openOrderCount,
            LocalDate lastOrderDate
    ) {
    }
}

