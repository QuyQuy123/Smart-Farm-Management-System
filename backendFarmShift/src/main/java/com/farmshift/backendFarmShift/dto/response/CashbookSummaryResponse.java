package com.farmshift.backendFarmShift.dto.response;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record CashbookSummaryResponse(
        long totalRevenue,
        long totalExpense,
        long totalFundsBalance,
        List<FundResponse> funds,
        List<TransactionResponse> transactions,
        List<TransferResponse> transfers
) {
    public record FundResponse(
            Long id,
            String name,
            String accountNo,
            String bank,
            String fundType,
            long balance,
            String note,
            boolean active
    ) {
    }

    public record TransactionResponse(
            Long id,
            String code,
            LocalDate date,
            String type,
            String category,
            long amount,
            String contact,
            String name,
            Long fundId,
            String fund,
            String note,
            String creator,
            String referenceInvoiceCode,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
    }

    public record TransferResponse(
            Long id,
            String code,
            LocalDate date,
            Long fromFundId,
            String from,
            Long toFundId,
            String to,
            long amount,
            long fee,
            String note,
            String creator
    ) {
    }
}

