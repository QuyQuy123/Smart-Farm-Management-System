package com.farmshift.backendFarmShift.service;

import com.farmshift.backendFarmShift.dto.request.CycleDiseaseRequest;
import com.farmshift.backendFarmShift.dto.request.CycleDiseaseUpdateRequest;
import com.farmshift.backendFarmShift.dto.request.DiseaseTreatmentRequest;
import com.farmshift.backendFarmShift.dto.response.CycleDiseaseResponse;
import com.farmshift.backendFarmShift.dto.response.CycleDiseaseResponse.MedicineSource;
import com.farmshift.backendFarmShift.dto.response.CycleDiseaseResponse.TreatmentItem;
import com.farmshift.backendFarmShift.entity.*;
import com.farmshift.backendFarmShift.exception.BadRequestException;
import com.farmshift.backendFarmShift.exception.ConflictException;
import com.farmshift.backendFarmShift.exception.ResourceNotFoundException;
import com.farmshift.backendFarmShift.repository.*;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;

import static com.farmshift.backendFarmShift.service.CycleService.*;

/**
 * Sổ bệnh án theo dõi đợt bệnh kéo dài nhiều ngày trong lứa nuôi (OPS-02).
 * Trừ kho FIFO nguyên tử, hoàn trả tồn kho 1:1 khi xóa/hoàn tác, hạch toán duy nhất 1 CycleExpense(MEDICINE),
 * và ẩn toàn bộ trường tài chính khi canSeeFinance == false.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CycleDiseaseService {
    private final CycleService cycleService;
    private final CycleDiseaseRepository diseaseRepository;
    private final DiseaseTreatmentLogRepository treatmentRepository;
    private final FlockRepository flockRepository;
    private final WarehouseCategoryRepository warehouseRepository;
    private final InventoryItemRepository inventoryRepository;
    private final CycleExpenseRepository expenseRepository;
    private final EntityManager entityManager;

    public List<CycleDiseaseResponse> list(Long cycleId, boolean canSeeFinance) {
        cycleService.find(cycleId);
        List<CycleDisease> diseases = diseaseRepository.findAllByCycleIdOrderByStartDateDescIdDesc(cycleId);
        if (diseases.isEmpty()) return List.of();

        List<Long> diseaseIds = diseases.stream().map(CycleDisease::getId).toList();
        Map<Long, List<DiseaseTreatmentLog>> treatmentsByDisease = new HashMap<>();
        for (DiseaseTreatmentLog log : treatmentRepository.findAllByDiseaseIdInOrderByTreatmentDateAscIdAsc(diseaseIds)) {
            treatmentsByDisease.computeIfAbsent(log.getDisease().getId(), ignored -> new ArrayList<>()).add(log);
        }
        return diseases.stream()
                .map(d -> toResponse(d, treatmentsByDisease.getOrDefault(d.getId(), List.of()), canSeeFinance))
                .toList();
    }

    /** Danh sách thuốc có sẵn trong kho thuốc của Khu nuôi chứa chuồng (nhóm theo kho + mặt hàng + đơn vị). */
    public List<MedicineSource> listMedicineSources(Long cycleId, boolean canSeeFinance) {
        FarmingCycle cycle = cycleService.find(cycleId);
        Long areaId = cycle.getBarn().getArea().getId();
        Set<Long> areaWarehouseIds = new HashSet<>();
        for (WarehouseCategory wh : warehouseRepository.findAllByArea_Id(areaId)) {
            if (wh.getKind() == null || AreaWarehouseService.MEDICINE.equalsIgnoreCase(wh.getKind())) {
                areaWarehouseIds.add(wh.getId());
            }
        }
        if (areaWarehouseIds.isEmpty()) return List.of();

        Map<String, List<InventoryItem>> groups = new LinkedHashMap<>();
        for (InventoryItem item : inventoryRepository.findAllWithDetailsBy(Sort.by("createdAt", "id"))) {
            if (item.getWarehouse() == null || !areaWarehouseIds.contains(item.getWarehouse().getId())) continue;
            Long unitId = item.getUnit() == null ? null : item.getUnit().getId();
            String key = item.getWarehouse().getId() + ":" + item.getProduct().getId() + ":" + unitId;
            groups.computeIfAbsent(key, ignored -> new ArrayList<>()).add(item);
        }

        List<MedicineSource> sources = new ArrayList<>();
        for (List<InventoryItem> lots : groups.values()) {
            InventoryItem first = lots.getFirst();
            BigDecimal totalStock = lots.stream().map(InventoryItem::getStock).reduce(BigDecimal.ZERO, BigDecimal::add);
            if (totalStock.signum() <= 0) continue;
            BigDecimal avgPrice = null;
            if (canSeeFinance) {
                BigDecimal totalValue = lots.stream()
                        .filter(l -> l.getStock().signum() > 0)
                        .map(l -> l.getStock().multiply(l.getPrice()))
                        .reduce(BigDecimal.ZERO, BigDecimal::add);
                avgPrice = totalValue.divide(totalStock, 0, RoundingMode.HALF_UP);
            }
            sources.add(new MedicineSource(
                    first.getId(),
                    first.getWarehouse().getId(),
                    first.getWarehouse().getName(),
                    first.getProduct().getId(),
                    first.getProduct().getName(),
                    first.getUnit() == null ? null : first.getUnit().getId(),
                    first.getUnit() == null ? "" : first.getUnit().getName(),
                    totalStock,
                    avgPrice
            ));
        }
        sources.sort(Comparator.comparing(MedicineSource::productName, String.CASE_INSENSITIVE_ORDER)
                .thenComparing(MedicineSource::warehouseName, String.CASE_INSENSITIVE_ORDER));
        return sources;
    }

    @Transactional
    public CycleDiseaseResponse createDisease(Long cycleId, CycleDiseaseRequest request, String user, boolean canSeeFinance) {
        FarmingCycle cycle = cycleService.requireActive(cycleId);
        checkDate(cycle, request.startDate(), "Ngày phát hiện bệnh");

        Flock flock = null;
        if (request.flockId() != null) {
            flock = flockRepository.findById(request.flockId())
                    .filter(f -> f.getCycle() != null && f.getCycle().getId().equals(cycleId))
                    .orElseThrow(() -> new BadRequestException("Đàn không thuộc lứa nuôi hiện tại.", "FLOCK_NOT_IN_CYCLE"));
        }

        CycleDisease disease = new CycleDisease();
        disease.setCycle(cycle);
        disease.setFlock(flock);
        disease.setDiseaseName(FarmAreaService.normalizeName(request.diseaseName()));
        disease.setSymptoms(clean(request.symptoms()));
        disease.setStartDate(request.startDate());
        disease.setStatus(DiseaseStatus.ACTIVE);
        disease.setAffectedQuantity(request.affectedQuantity());
        disease.setNote(clean(request.note()));
        disease.setCreatedBy(user);
        CycleDisease saved = diseaseRepository.saveAndFlush(disease);
        return toResponse(saved, List.of(), canSeeFinance);
    }

    @Transactional
    public CycleDiseaseResponse updateDisease(Long cycleId, Long diseaseId, CycleDiseaseUpdateRequest request, boolean canSeeFinance) {
        cycleService.requireActive(cycleId);
        CycleDisease disease = diseaseRepository.findByIdAndCycleId(diseaseId, cycleId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đợt bệnh."));

        if (request.diseaseName() != null && !request.diseaseName().isBlank()) {
            disease.setDiseaseName(FarmAreaService.normalizeName(request.diseaseName()));
        }
        if (request.symptoms() != null) {
            disease.setSymptoms(clean(request.symptoms()));
        }
        if (request.affectedQuantity() != null) {
            disease.setAffectedQuantity(request.affectedQuantity());
        }
        if (request.note() != null) {
            disease.setNote(clean(request.note()));
        }

        List<DiseaseTreatmentLog> existingLogs = treatmentRepository.findAllByDiseaseIdOrderByTreatmentDateAscIdAsc(disease.getId());
        DiseaseStatus targetStatus = request.status() != null ? request.status() : disease.getStatus();
        if (targetStatus == DiseaseStatus.RECOVERED) {
            LocalDate end = request.endDate() != null ? request.endDate() : today();
            if (end.isBefore(disease.getStartDate())) {
                throw new BadRequestException("Ngày khỏi bệnh không được trước ngày phát hiện bệnh (" + format(disease.getStartDate()) + ").", "DISEASE_DATE_RANGE");
            }
            if (end.isAfter(today())) {
                throw new BadRequestException("Ngày khỏi bệnh không được sau hôm nay.", "DISEASE_DATE_FUTURE");
            }
            LocalDate lastTreatmentDate = existingLogs.stream()
                    .map(DiseaseTreatmentLog::getTreatmentDate)
                    .max(Comparator.naturalOrder())
                    .orElse(null);
            if (lastTreatmentDate != null && end.isBefore(lastTreatmentDate)) {
                throw new BadRequestException("Ngày khỏi bệnh không được trước ngày dùng thuốc cuối cùng (" + format(lastTreatmentDate) + ").", "DISEASE_END_BEFORE_TREATMENT");
            }
            disease.setEndDate(end);
            disease.setStatus(DiseaseStatus.RECOVERED);
        } else {
            disease.setStatus(DiseaseStatus.ACTIVE);
            disease.setEndDate(null);
        }

        CycleDisease saved = diseaseRepository.saveAndFlush(disease);
        return toResponse(saved, existingLogs, canSeeFinance);
    }

    @Transactional
    public void deleteDisease(Long cycleId, Long diseaseId) {
        cycleService.requireActive(cycleId);
        CycleDisease disease = diseaseRepository.findByIdAndCycleId(diseaseId, cycleId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đợt bệnh."));
        if (treatmentRepository.existsByDiseaseId(diseaseId)) {
            throw new ConflictException("Đợt bệnh đã có nhật ký dùng thuốc. Vui lòng hoàn tác/xóa các lần dùng thuốc trước khi xóa đợt bệnh để bảo toàn tồn kho.",
                    "DISEASE_HAS_TREATMENTS", null);
        }
        diseaseRepository.delete(disease);
    }

    @Transactional
    public CycleDiseaseResponse addTreatment(Long cycleId, Long diseaseId, DiseaseTreatmentRequest request,
                                             String user, boolean canSeeFinance) {
        FarmingCycle cycle = cycleService.requireActive(cycleId);
        CycleDisease disease = diseaseRepository.findByIdAndCycleId(diseaseId, cycleId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đợt bệnh."));
        if (disease.getStatus() == DiseaseStatus.RECOVERED) {
            throw new ConflictException("Đợt bệnh đã đánh dấu khỏi. Hãy mở lại điều trị nếu cần ghi thêm thuốc.", "DISEASE_ALREADY_RECOVERED", null);
        }

        LocalDate date = request.treatmentDate();
        checkDate(cycle, date, "Ngày dùng thuốc");
        if (date.isBefore(disease.getStartDate())) {
            throw new BadRequestException("Ngày dùng thuốc không được trước ngày phát hiện bệnh (" + format(disease.getStartDate()) + ").", "TREATMENT_DATE_BEFORE_START");
        }

        DiseaseTreatmentLog log = new DiseaseTreatmentLog();
        log.setDisease(disease);
        log.setTreatmentDate(date);
        log.setMethod(request.method());
        log.setDosageText(clean(request.dosageText()));
        log.setNote(clean(request.note()));
        log.setCreatedBy(user);

        BigDecimal cost = BigDecimal.ZERO;
        String resolvedMedicineName;

        if (request.inventoryItemId() != null) {
            if (request.stockQuantity() == null || request.stockQuantity().signum() <= 0) {
                throw new BadRequestException("Vui lòng nhập số lượng xuất kho lớn hơn 0.", "TREATMENT_QUANTITY_REQUIRED");
            }
            BigDecimal qty = request.stockQuantity().setScale(6, RoundingMode.HALF_UP);

            InventoryItem anchor = inventoryRepository.findWithDetailsById(request.inventoryItemId())
                    .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy thuốc trong kho."));

            // Validate warehouse belongs to the barn's FarmArea AND is a MEDICINE (or untyped) warehouse
            Long areaId = cycle.getBarn().getArea().getId();
            Set<Long> allowedWarehouses = new HashSet<>();
            for (WarehouseCategory w : warehouseRepository.findAllByArea_Id(areaId)) {
                if (w.getKind() == null || AreaWarehouseService.MEDICINE.equalsIgnoreCase(w.getKind())) {
                    allowedWarehouses.add(w.getId());
                }
            }
            if (anchor.getWarehouse() == null || !allowedWarehouses.contains(anchor.getWarehouse().getId())) {
                throw new BadRequestException("Kho nguồn phải là kho thuốc thuộc khu nuôi của chuồng này.", "STOCK_SOURCE_INVALID");
            }

            Long unitId = anchor.getUnit() == null ? null : anchor.getUnit().getId();
            List<InventoryItem> fifoLots = inventoryRepository
                    .findByWarehouse_IdAndProduct_IdOrderByCreatedAtAscIdAsc(anchor.getWarehouse().getId(), anchor.getProduct().getId())
                    .stream()
                    .filter(lot -> Objects.equals(lot.getUnit() == null ? null : lot.getUnit().getId(), unitId))
                    .toList();

            BigDecimal available = fifoLots.stream().map(InventoryItem::getStock).reduce(BigDecimal.ZERO, BigDecimal::add);
            if (available.compareTo(qty) < 0) {
                throw new BadRequestException("Kho chỉ còn " + DailyPlanService.amount(available) + " "
                        + (anchor.getUnit() == null ? "" : anchor.getUnit().getName()) + ", cần "
                        + DailyPlanService.amount(qty) + ". Hãy nhập kho trước khi ghi nhận.", "STOCK_NOT_ENOUGH");
            }

            BigDecimal remaining = qty;
            for (InventoryItem lot : fifoLots) {
                if (remaining.signum() <= 0) break;
                entityManager.refresh(lot);
                BigDecimal take = lot.getStock().min(remaining);
                if (take.signum() <= 0) continue;
                if (inventoryRepository.takeStock(lot.getId(), take) != 1) {
                    throw new ConflictException("Tồn kho vừa thay đổi. Vui lòng tải lại và thử lại.", "STOCK_CHANGED", null);
                }
                entityManager.refresh(lot);
                DiseaseTreatmentStockAllocation alloc = new DiseaseTreatmentStockAllocation();
                alloc.setItem(lot);
                alloc.setQuantity(take);
                log.getStockAllocations().add(alloc);
                cost = cost.add(take.multiply(lot.getPrice()));
                remaining = remaining.subtract(take);
            }
            if (remaining.signum() > 0) {
                throw new BadRequestException("Kho không đủ tồn kho thuốc để xuất.", "STOCK_NOT_ENOUGH");
            }

            cost = cost.setScale(0, RoundingMode.HALF_UP);
            BigDecimal avgUnitPrice = qty.signum() == 0 ? BigDecimal.ZERO : cost.divide(qty, 2, RoundingMode.HALF_UP);
            resolvedMedicineName = (request.medicineName() != null && !request.medicineName().isBlank())
                    ? request.medicineName().strip()
                    : anchor.getProduct().getName();

            log.setMedicineName(resolvedMedicineName);
            log.setInventoryItem(anchor);
            log.setStockQuantity(qty);
            log.setUnitPrice(avgUnitPrice);
            log.setCost(cost);
        } else {
            if (request.medicineName() == null || request.medicineName().isBlank()) {
                throw new BadRequestException("Vui lòng nhập tên thuốc điều trị.", "TREATMENT_MEDICINE_REQUIRED");
            }
            resolvedMedicineName = request.medicineName().strip();
            log.setMedicineName(resolvedMedicineName);
            if (canSeeFinance && request.manualCost() != null && request.manualCost().signum() > 0) {
                cost = request.manualCost().setScale(0, RoundingMode.HALF_UP);
            }
            log.setCost(cost);
        }

        if (cost.signum() > 0) {
            CycleExpense expense = new CycleExpense();
            expense.setCycle(cycle);
            expense.setExpenseDate(date);
            expense.setCategory(ExpenseCategory.MEDICINE);
            expense.setAmount(cost);
            expense.setNote("Điều trị " + disease.getDiseaseName() + ": " + resolvedMedicineName);
            expense.setCreatedBy(user);
            log.setExpense(expenseRepository.save(expense));
        }

        treatmentRepository.saveAndFlush(log);
        List<DiseaseTreatmentLog> logs = treatmentRepository.findAllByDiseaseIdOrderByTreatmentDateAscIdAsc(diseaseId);
        return toResponse(disease, logs, canSeeFinance);
    }

    @Transactional
    public CycleDiseaseResponse deleteTreatment(Long cycleId, Long diseaseId, Long treatmentId,
                                                String user, boolean isOwner, boolean canSeeFinance) {
        cycleService.requireActive(cycleId);
        CycleDisease disease = diseaseRepository.findByIdAndCycleId(diseaseId, cycleId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đợt bệnh."));
        DiseaseTreatmentLog log = treatmentRepository.findByIdAndDiseaseId(treatmentId, diseaseId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy nhật ký dùng thuốc."));

        if (!isOwner) {
            boolean own = log.getCreatedBy() != null && log.getCreatedBy().equalsIgnoreCase(user);
            boolean sameDay = (log.getCreatedAt() != null && log.getCreatedAt().toLocalDate().equals(today()))
                    || log.getTreatmentDate().equals(today());
            if (!own || !sameDay) {
                throw new ConflictException("Công nhân chỉ hoàn tác được lần dùng thuốc do mình ghi trong hôm nay.",
                        "TREATMENT_UNDO_FORBIDDEN", null);
            }
        }

        if (!log.getStockAllocations().isEmpty()) {
            for (DiseaseTreatmentStockAllocation alloc : log.getStockAllocations()) {
                inventoryRepository.returnStock(alloc.getItem().getId(), alloc.getQuantity());
                entityManager.refresh(alloc.getItem());
            }
        } else if (log.getInventoryItem() != null && log.getStockQuantity() != null) {
            inventoryRepository.returnStock(log.getInventoryItem().getId(), log.getStockQuantity());
            entityManager.refresh(log.getInventoryItem());
        }

        CycleExpense expense = log.getExpense();
        treatmentRepository.delete(log);
        treatmentRepository.flush();
        if (expense != null) {
            expenseRepository.delete(expense);
        }

        List<DiseaseTreatmentLog> remainingLogs = treatmentRepository.findAllByDiseaseIdOrderByTreatmentDateAscIdAsc(diseaseId);
        return toResponse(disease, remainingLogs, canSeeFinance);
    }

    private static CycleDiseaseResponse toResponse(CycleDisease disease, List<DiseaseTreatmentLog> logs, boolean canSeeFinance) {
        LocalDate endRef = disease.getEndDate();
        if (endRef == null) {
            FarmingCycle cycle = disease.getCycle();
            endRef = (cycle != null && cycle.getEndDate() != null) ? cycle.getEndDate() : today();
        }
        long treatmentDays = Math.max(1L, ChronoUnit.DAYS.between(disease.getStartDate(), endRef) + 1L);

        BigDecimal totalCost = canSeeFinance
                ? logs.stream().map(DiseaseTreatmentLog::getCost).filter(Objects::nonNull)
                        .reduce(BigDecimal.ZERO, BigDecimal::add).setScale(0, RoundingMode.HALF_UP)
                : null;

        List<TreatmentItem> items = logs.stream().map(log -> new TreatmentItem(
                log.getId(),
                log.getTreatmentDate(),
                log.getMedicineName(),
                log.getMethod(),
                log.getDosageText(),
                log.getInventoryItem() == null ? null : log.getInventoryItem().getId(),
                log.getInventoryItem() == null || log.getInventoryItem().getWarehouse() == null ? null : log.getInventoryItem().getWarehouse().getName(),
                log.getInventoryItem() == null || log.getInventoryItem().getUnit() == null ? null : log.getInventoryItem().getUnit().getName(),
                log.getStockQuantity(),
                canSeeFinance ? log.getUnitPrice() : null,
                canSeeFinance ? log.getCost() : null,
                log.getExpense() == null ? null : log.getExpense().getId(),
                log.getNote(),
                log.getCreatedBy(),
                log.getCreatedAt()
        )).toList();

        return new CycleDiseaseResponse(
                disease.getId(),
                disease.getCycle().getId(),
                disease.getFlock() == null ? null : disease.getFlock().getId(),
                disease.getFlock() == null ? null : flockCode(disease.getFlock()),
                disease.getFlock() == null ? null : disease.getFlock().getName(),
                disease.getDiseaseName(),
                disease.getSymptoms(),
                disease.getStartDate(),
                disease.getEndDate(),
                disease.getStatus(),
                disease.getAffectedQuantity(),
                treatmentDays,
                totalCost,
                disease.getNote(),
                disease.getCreatedBy(),
                disease.getCreatedAt(),
                items
        );
    }
}
