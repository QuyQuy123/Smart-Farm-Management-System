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
        List<TransferResponse> transfers,
        List<CostAllocationResponse> costAllocations,
        List<AssetResponse> assets,
        List<PayrollResponse> payrolls,
        List<CategoryResponse> categories,
        List<StaffOption> staffOptions,
        List<CycleOption> cycleOptions
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

    public record CostAllocationResponse(
            Long id,
            String code,
            Long cycleId,
            String house,
            String cycle,
            String type,
            long amount,
            String source,
            LocalDate date,
            String notes
    ) {
    }

    public record AssetResponse(
            Long id,
            String code,
            String name,
            long cost,
            int months,
            long monthlyDep,
            String house,
            LocalDate purchaseDate,
            String status,
            String note
    ) {
    }

    public record PayrollResponse(
            Long id,
            String code,
            Long accountId,
            String employee,
            String period,
            int days,
            long rate,
            long bonus,
            long advance,
            long total,
            long paid,
            long remain,
            String status,
            String note
    ) {
    }

    public record CategoryResponse(
            Long id,
            String name,
            String type,
            String group,
            String note,
            boolean active
    ) {
    }

    public record StaffOption(
            Long id,
            String fullName,
            String roleName
    ) {
    }

    public record CycleOption(
            Long id,
            String code,
            String barnName,
            int cycleNumber,
            String status
    ) {
    }
}
