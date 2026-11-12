package com.farmshift.backendFarmShift.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Báo cáo tổng hợp toàn trang trại chuẩn FarmShift cho 9 phân hệ báo cáo.
 */
public record ReportSummaryResponse(
        LocalDate from,
        LocalDate to,
        LocalDate generatedDate,
        FarmSummary farmSummary,
        SalesReport salesReport,
        PurchasesReport purchasesReport,
        InventoryReport inventoryReport,
        CashbookReport cashbookReport,
        HarvestReport harvestReport,
        GrowthReport growthReport,
        InternalStockReport internalStockReport,
        ActivityReport activityReport
) {
    public record FarmSummary(
            int totalIn,
            int harvested,
            BigDecimal harvestedWeightKg,
            int deaths,
            int culls,
            int currentLive,
            int activeBarns,
            int totalCycles,
            BigDecimal lossRate,
            BigDecimal survivalRate,
            BigDecimal totalCost,
            BigDecimal totalRevenue,
            BigDecimal totalProfit,
            List<BarnCycleRow> cycles
    ) {}

    public record BarnCycleRow(
            Long cycleId,
            String cycleCode,
            String barnName,
            String areaName,
            String breed,
            String status,
            LocalDate startDate,
            LocalDate endDate,
            int totalIn,
            int deaths,
            int culls,
            int harvested,
            int transferredOut,
            int currentQuantity,
            BigDecimal survivalRate,
            BigDecimal totalCost,
            BigDecimal revenue,
            BigDecimal profit
    ) {}

    public record SalesReport(
            int orderCount,
            BigDecimal totalRevenue,
            BigDecimal paidAmount,
            BigDecimal debtAmount,
            BigDecimal totalWeightKg,
            int totalQuantity,
            BigDecimal avgUnitPrice,
            List<SalesOrderRow> orders
    ) {}

    public record SalesOrderRow(
            String id,
            String code,
            LocalDate date,
            String customer,
            String flock,
            int quantity,
            BigDecimal totalWeight,
            BigDecimal unitPrice,
            BigDecimal totalAmount,
            BigDecimal paidAmount,
            BigDecimal debtAmount,
            String status
    ) {}

    public record PurchasesReport(
            int invoiceCount,
            int cancelledCount,
            long totalAmount,
            long paidAmount,
            long debtAmount,
            List<PurchaseRow> invoices
    ) {}

    public record PurchaseRow(
            Long id,
            String code,
            LocalDate date,
            String supplier,
            String warehouseSummary,
            long totalAmount,
            long paidAmount,
            long debtAmount,
            String paymentStatus,
            String stockStatus
    ) {}

    public record InventoryReport(
            int totalSkus,
            BigDecimal totalValue,
            int lowStockCount,
            int expiryAlertCount,
            List<InventoryRow> items
    ) {}

    public record InventoryRow(
            Long id,
            String code,
            String name,
            String warehouseName,
            String productType,
            String unitName,
            BigDecimal stock,
            BigDecimal minStock,
            BigDecimal unitPrice,
            BigDecimal totalValue,
            String lotNumber,
            LocalDate expiryDate,
            boolean lowStock,
            String expiryStatus
    ) {}

    public record CashbookReport(
            long cashIn,
            long cashOut,
            long netCashflow,
            long totalFundsBalance,
            int transactionCount,
            List<FundFlowRow> funds,
            List<CategoryBreakdownRow> categoryBreakdown
    ) {}

    public record FundFlowRow(
            Long id,
            String name,
            String fundType,
            String bank,
            long cashIn,
            long cashOut,
            long balance
    ) {}

    public record CategoryBreakdownRow(
            String category,
            String type,
            int count,
            long totalAmount
    ) {}

    public record HarvestReport(
            int harvestEvents,
            int totalHead,
            BigDecimal totalWeightKg,
            BigDecimal totalRevenue,
            BigDecimal avgUnitPrice,
            List<HarvestCycleRow> rows
    ) {}

    public record HarvestCycleRow(
            Long cycleId,
            String cycleCode,
            String barnName,
            String areaName,
            String breed,
            int harvestEvents,
            int totalHead,
            BigDecimal totalWeightKg,
            BigDecimal avgWeightPerBird,
            BigDecimal totalRevenue,
            BigDecimal avgPricePerKg,
            LocalDate lastHarvestDate
    ) {}

    public record GrowthReport(
            int analyzedCycles,
            BigDecimal avgFcr,
            List<GrowthCycleRow> cycles
    ) {}

    public record GrowthCycleRow(
            Long cycleId,
            String cycleCode,
            String barnName,
            String areaName,
            String breed,
            String status,
            Integer ageDays,
            Integer targetDays,
            int totalIn,
            int currentQuantity,
            BigDecimal avgWeightKg,
            BigDecimal targetWeightKg,
            BigDecimal feedKg,
            BigDecimal feedPerBirdKg,
            BigDecimal gainKg,
            BigDecimal fcr,
            BigDecimal adgGrams,
            BigDecimal survivalRate
    ) {}

    public record InternalStockReport(
            int voucherCount,
            int exportCount,
            int transferCount,
            BigDecimal totalAmount,
            List<InternalStockRow> items
    ) {}

    public record InternalStockRow(
            Long voucherId,
            String code,
            LocalDate movementDate,
            String movementType,
            String categoryName,
            String itemName,
            String unitName,
            BigDecimal quantity,
            BigDecimal unitPrice,
            BigDecimal totalAmount,
            String sourceWarehouse,
            String targetDestination,
            String status
    ) {}

    public record ActivityReport(
            int totalActivities,
            List<ActivityRow> items
    ) {}

    public record ActivityRow(
            String id,
            LocalDateTime timestamp,
            LocalDate date,
            String actor,
            String module,
            String action,
            String detail,
            String referenceCode
    ) {}
}

