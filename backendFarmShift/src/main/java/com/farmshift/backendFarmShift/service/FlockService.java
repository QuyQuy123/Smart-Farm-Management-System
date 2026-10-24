package com.farmshift.backendFarmShift.service;

import com.farmshift.backendFarmShift.dto.request.FlockHarvestRequest;
import com.farmshift.backendFarmShift.dto.request.FlockImportRequest;
import com.farmshift.backendFarmShift.dto.request.FlockLossRequest;
import com.farmshift.backendFarmShift.dto.request.FlockProgramRequest;
import com.farmshift.backendFarmShift.dto.request.FlockTransferRequest;
import com.farmshift.backendFarmShift.dto.response.FlockMovementResponse;
import com.farmshift.backendFarmShift.dto.response.FlockResponse;
import com.farmshift.backendFarmShift.entity.*;
import com.farmshift.backendFarmShift.exception.BadRequestException;
import com.farmshift.backendFarmShift.exception.ResourceNotFoundException;
import com.farmshift.backendFarmShift.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

import static com.farmshift.backendFarmShift.service.CycleService.*;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class FlockService {
    private final FlockRepository repository;
    private final FlockMovementRepository movementRepository;
    private final FarmingCycleRepository cycleRepository;
    private final WeightSampleRepository weightRepository;
    private final CycleService cycleService;
    private final BarnService barnService;
    private final FarmingProgramService programService;

    /** Nhập đàn con giống vào lứa đang nuôi. */
    @Transactional
    public FlockResponse importFlock(Long cycleId, FlockImportRequest request, String user) {
        FarmingCycle cycle = cycleService.requireActive(cycleId);
        Barn barn = cycle.getBarn();
        LocalDate date = request.importDate();
        checkDate(cycle, date, "Ngày nhập đàn");
        checkImportWindow(cycle, date);
        checkCapacity(barn, request.quantity());

        Flock flock = new Flock();
        flock.setCycle(cycle);
        flock.setName(FarmAreaService.normalizeName(request.name()));
        flock.setProgram(programService.find(request.programId()));
        flock.setGender(request.gender());
        flock.setSourceType(FlockSource.PURCHASE);
        flock.setSourceNote(request.sourceNote() == null || request.sourceNote().isBlank() ? "Khác" : request.sourceNote().strip());
        flock.setImportDate(date);
        flock.setAgeAtImport(request.ageAtImport());
        flock.setImportQuantity(request.quantity());
        flock.setImportAvgWeight(request.avgWeight());
        flock.setUnitPrice(request.unitPrice());
        flock.setQuantity(request.quantity());
        flock.setStatus(FlockStatus.ACTIVE);
        flock.setNote(clean(request.note()));
        repository.save(flock);
        record(flock, FlockMovementType.IMPORT, date, request.quantity(), weightOf(request.avgWeight(), request.quantity()), null, null, flock.getNote(), user);
        barn.setCurrentQuantity(barn.getCurrentQuantity() + request.quantity());
        return flockResponse(flock, today(), true);
    }

    /** Tách / chuyển một phần đàn sang chuồng khác đang có lứa nuôi. Tổng số con toàn trại không đổi. */
    @Transactional
    public FlockResponse transfer(Long flockId, FlockTransferRequest request, String user) {
        Flock source = requireActive(flockId);
        FarmingCycle sourceCycle = source.getCycle();
        Barn sourceBarn = sourceCycle.getBarn();
        Barn target = barnService.find(request.targetBarnId());
        if (target.getId().equals(sourceBarn.getId())) {
            throw new BadRequestException("Hãy chọn chuồng đích khác chuồng đang nuôi đàn.", "TRANSFER_SAME_BARN");
        }
        FarmingCycle targetCycle = cycleRepository.findFirstByBarnIdAndStatus(target.getId(), CycleStatus.ACTIVE)
                .orElseThrow(() -> new BadRequestException("Chuồng " + target.getName() + " chưa có lứa nuôi. Hãy khai báo lứa cho chuồng đích trước.",
                        "TRANSFER_TARGET_NO_CYCLE"));
        int quantity = request.quantity();
        checkStock(source, quantity);
        checkCapacity(target, quantity);
        LocalDate date = request.transferDate();
        checkDate(sourceCycle, date, "Ngày chuyển đàn");
        checkDate(targetCycle, date, "Ngày chuyển đàn");
        checkNotBeforeImport(source, date);

        BigDecimal avgWeight = request.avgWeight() != null ? request.avgWeight() : currentAvgWeight(source, date);
        BigDecimal weight = weightOf(avgWeight, quantity);
        Flock moved = new Flock();
        moved.setCycle(targetCycle);
        moved.setName(request.name() == null || request.name().isBlank() ? source.getName() : FarmAreaService.normalizeName(request.name()));
        moved.setGender(source.getGender());
        // The moved birds keep their breed program and therefore their feeding / vaccination schedule.
        moved.setProgram(source.getProgram());
        moved.setSourceType(FlockSource.TRANSFER);
        moved.setSourceNote("Chuyển từ " + sourceBarn.getName() + " (" + flockCode(source) + ")");
        moved.setSourceFlock(source);
        moved.setImportDate(date);
        moved.setAgeAtImport(ageOn(source, date));
        moved.setImportQuantity(quantity);
        moved.setImportAvgWeight(avgWeight);
        // Giá vốn con giống đi theo đàn, nên chi phí chuyển sang lứa đích đúng theo tỷ lệ số con.
        moved.setUnitPrice(source.getUnitPrice());
        moved.setQuantity(quantity);
        moved.setStatus(FlockStatus.ACTIVE);
        moved.setNote(clean(request.note()));
        repository.save(moved);

        String note = clean(request.note());
        record(source, FlockMovementType.TRANSFER_OUT, date, quantity, weight, null, moved, note, user);
        record(moved, FlockMovementType.TRANSFER_IN, date, quantity, weight, null, source, note, user);
        decrease(source, quantity);
        target.setCurrentQuantity(target.getCurrentQuantity() + quantity);
        return flockResponse(moved, today(), true);
    }

    /**
     * Gắn hoặc đổi chương trình nuôi của đàn (ví dụ đàn nhập trước khi có chương trình). Lịch cám / vắc-xin tính theo ngày tuổi hiện tại,
     * nên không cho gắn chương trình ngắn hơn tuổi của đàn.
     */
    @Transactional
    public FlockResponse assignProgram(Long flockId, FlockProgramRequest request) {
        Flock flock = requireActive(flockId);
        FarmingProgram program = programService.find(request.programId());
        checkProgramFits(flock, program);
        flock.setProgram(program);
        return flockResponse(flock, today(), true);
    }

    /** Gắn cùng một chương trình nuôi cho tất cả đàn đang nuôi của lứa; đàn nào quá tuổi chương trình thì không gắn đàn nào. */
    @Transactional
    public List<FlockResponse> assignProgramToCycle(Long cycleId, FlockProgramRequest request) {
        cycleService.requireActive(cycleId);
        FarmingProgram program = programService.find(request.programId());
        List<Flock> flocks = repository.findAllByCycleIdOrderByImportDateAscIdAsc(cycleId).stream()
                .filter(flock -> flock.getStatus() == FlockStatus.ACTIVE).toList();
        if (flocks.isEmpty()) {
            throw new BadRequestException("Lứa nuôi chưa có đàn đang nuôi để gắn chương trình.", "CYCLE_NO_ACTIVE_FLOCK");
        }
        flocks.forEach(flock -> checkProgramFits(flock, program));
        flocks.forEach(flock -> flock.setProgram(program));
        return flocks.stream().map(flock -> flockResponse(flock, today(), true)).toList();
    }

    /** Lịch chương trình tính theo ngày tuổi hiện tại, nên chương trình phải dài hơn tuổi của đàn. */
    private static void checkProgramFits(Flock flock, FarmingProgram program) {
        int age = ageOn(flock, today());
        if (age > program.getDurationDays()) {
            throw new BadRequestException("Đàn " + flockCode(flock) + " đã " + age + " ngày tuổi, vượt thời gian nuôi " + program.getDurationDays()
                    + " ngày của chương trình " + program.getName() + ".", "FLOCK_PROGRAM_TOO_SHORT");
        }
    }

    /** Ghi hao hụt (chết) hoặc loại thải. */
    @Transactional
    public FlockMovementResponse recordLoss(Long flockId, FlockLossRequest request, String user) {
        if (request.type() != FlockMovementType.DEATH && request.type() != FlockMovementType.CULL) {
            throw new BadRequestException("Chỉ ghi nhận hao hụt (chết) hoặc loại thải.", "FLOCK_LOSS_TYPE");
        }
        Flock flock = requireActive(flockId);
        checkStock(flock, request.quantity());
        checkDate(flock.getCycle(), request.movementDate(), "Ngày ghi nhận");
        checkNotBeforeImport(flock, request.movementDate());
        FlockMovement movement = record(flock, request.type(), request.movementDate(), request.quantity(), request.weightKg(), null, null,
                clean(request.note()), user);
        decrease(flock, request.quantity());
        return movementResponse(movement, false);
    }

    /** Xuất bán / thu hoạch, ghi doanh thu theo khối lượng và đơn giá. */
    @Transactional
    public FlockMovementResponse harvest(Long flockId, FlockHarvestRequest request, String user) {
        Flock flock = requireActive(flockId);
        checkStock(flock, request.quantity());
        checkDate(flock.getCycle(), request.movementDate(), "Ngày xuất bán");
        checkNotBeforeImport(flock, request.movementDate());
        FlockMovement movement = record(flock, FlockMovementType.HARVEST, request.movementDate(), request.quantity(), request.weightKg(),
                request.unitPrice(), null, clean(request.note()), user);
        decrease(flock, request.quantity());
        return movementResponse(movement, true);
    }

    // ---------------------------------------------------------------- rules

    /** Đàn nhập sau không được cách đàn nhập đầu tiên của lứa quá {@link CycleService#MAX_IMPORT_SPREAD_DAYS} ngày. */
    private void checkImportWindow(FarmingCycle cycle, LocalDate date) {
        List<LocalDate> imports = repository.findAllByCycleIdOrderByImportDateAscIdAsc(cycle.getId()).stream()
                .filter(f -> f.getSourceType() == FlockSource.PURCHASE).map(Flock::getImportDate).toList();
        if (imports.isEmpty()) return;
        LocalDate first = imports.get(0).isBefore(date) ? imports.get(0) : date;
        LocalDate last = imports.get(imports.size() - 1).isAfter(date) ? imports.get(imports.size() - 1) : date;
        if (ChronoUnit.DAYS.between(first, last) > MAX_IMPORT_SPREAD_DAYS) {
            throw new BadRequestException("Các đàn trong một lứa phải nhập cách nhau không quá " + MAX_IMPORT_SPREAD_DAYS
                    + " ngày (đàn đầu tiên nhập ngày " + format(imports.get(0)) + "). Hãy khai báo lứa nuôi mới cho đàn này.", "FLOCK_IMPORT_WINDOW");
        }
    }

    private static void checkCapacity(Barn barn, int quantity) {
        int room = barn.getCapacity() - barn.getCurrentQuantity();
        if (quantity > room) {
            throw new BadRequestException("Chuồng " + barn.getName() + " chỉ còn chỗ cho " + Math.max(room, 0) + " con (sức chứa "
                    + barn.getCapacity() + ", đang nuôi " + barn.getCurrentQuantity() + ").", "FLOCK_OVER_CAPACITY");
        }
    }

    private static void checkStock(Flock flock, int quantity) {
        if (quantity > flock.getQuantity()) {
            throw new BadRequestException("Đàn " + flockCode(flock) + " chỉ còn " + flock.getQuantity() + " con.", "FLOCK_INSUFFICIENT");
        }
    }

    private static void checkNotBeforeImport(Flock flock, LocalDate date) {
        if (date.isBefore(flock.getImportDate())) {
            throw new BadRequestException("Ngày ghi nhận không được trước ngày nhập đàn (" + format(flock.getImportDate()) + ").", "FLOCK_DATE_BEFORE_IMPORT");
        }
    }

    private Flock requireActive(Long flockId) {
        Flock flock = repository.findById(flockId).orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đàn."));
        cycleService.requireActive(flock.getCycle().getId());
        if (flock.getStatus() != FlockStatus.ACTIVE) {
            throw new BadRequestException("Đàn " + flockCode(flock) + " đã hết tồn và được lưu trữ.", "FLOCK_ARCHIVED");
        }
        return flock;
    }

    /** Latest weighing of the cycle up to the date, otherwise the weight the flock arrived with. */
    private BigDecimal currentAvgWeight(Flock flock, LocalDate date) {
        return weightRepository.findAllByCycleIdOrderBySampleDateDescIdDesc(flock.getCycle().getId()).stream()
                .filter(sample -> !sample.getSampleDate().isAfter(date)).findFirst()
                .map(WeightSample::getAvgWeightKg).orElse(flock.getImportAvgWeight());
    }

    private void decrease(Flock flock, int quantity) {
        flock.setQuantity(flock.getQuantity() - quantity);
        if (flock.getQuantity() == 0) flock.setStatus(FlockStatus.ARCHIVED);
        Barn barn = flock.getCycle().getBarn();
        barn.setCurrentQuantity(barn.getCurrentQuantity() - quantity);
    }

    private static BigDecimal weightOf(BigDecimal avgWeight, int quantity) {
        return avgWeight.multiply(BigDecimal.valueOf(quantity)).setScale(3, RoundingMode.HALF_UP);
    }

    private FlockMovement record(Flock flock, FlockMovementType type, LocalDate date, int quantity, BigDecimal weightKg,
                                 BigDecimal unitPrice, Flock related, String note, String user) {
        FlockMovement movement = new FlockMovement();
        movement.setFlock(flock);
        movement.setType(type);
        movement.setMovementDate(date);
        movement.setQuantity(quantity);
        movement.setWeightKg(weightKg);
        movement.setUnitPrice(unitPrice);
        movement.setRelatedFlock(related);
        movement.setNote(note);
        movement.setCreatedBy(user);
        return movementRepository.save(movement);
    }
}
