package com.farmshift.backendFarmShift.dto.response;

import com.farmshift.backendFarmShift.entity.AdministrationMethod;
import com.farmshift.backendFarmShift.entity.DiseaseStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** Chi tiết một đợt bệnh kèm nhật ký dùng thuốc nhiều ngày và tổng tiền thuốc (null nếu !canSeeFinance). */
public record CycleDiseaseResponse(
        Long id,
        Long cycleId,
        Long flockId,
        String flockCode,
        String flockName,
        String diseaseName,
        String symptoms,
        LocalDate startDate,
        LocalDate endDate,
        DiseaseStatus status,
        Integer affectedQuantity,
        long treatmentDays,
        BigDecimal totalMedicineCost,
        String note,
        String createdBy,
        LocalDateTime createdAt,
        List<TreatmentItem> treatments
) {
    public record TreatmentItem(
            Long id,
            LocalDate treatmentDate,
            String medicineName,
            AdministrationMethod method,
            String dosageText,
            Long inventoryItemId,
            String warehouseName,
            String unitName,
            BigDecimal stockQuantity,
            BigDecimal unitPrice,
            BigDecimal cost,
            Long expenseId,
            String note,
            String createdBy,
            LocalDateTime createdAt
    ) { }

    public record MedicineSource(
            Long itemId,
            Long warehouseId,
            String warehouseName,
            Long productId,
            String productName,
            Long unitId,
            String unitName,
            BigDecimal availableStock,
            BigDecimal averagePrice
    ) { }
}
