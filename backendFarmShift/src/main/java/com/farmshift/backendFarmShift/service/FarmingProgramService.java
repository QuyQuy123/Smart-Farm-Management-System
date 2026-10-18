package com.farmshift.backendFarmShift.service;

import com.farmshift.backendFarmShift.dto.request.FarmingProgramRequest;
import com.farmshift.backendFarmShift.dto.response.FarmingProgramResponse;
import com.farmshift.backendFarmShift.dto.response.ProgramStepResponse;
import com.farmshift.backendFarmShift.entity.*;
import com.farmshift.backendFarmShift.exception.BadRequestException;
import com.farmshift.backendFarmShift.exception.ConflictException;
import com.farmshift.backendFarmShift.exception.ResourceNotFoundException;
import com.farmshift.backendFarmShift.repository.CycleProgramRepository;
import com.farmshift.backendFarmShift.repository.FarmingProgramRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Locale;

import static com.farmshift.backendFarmShift.service.CycleService.clean;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class FarmingProgramService {
    private final FarmingProgramRepository repository;
    private final CycleProgramRepository cycleProgramRepository;
    private final CycleService cycleService;

    public List<FarmingProgramResponse> list() {
        return repository.findAllByOrderByNameAsc().stream()
                .map(program -> response(program, cycleProgramRepository.countByProgramIdAndCycleStatus(program.getId(), CycleStatus.ACTIVE), null))
                .toList();
    }

    public FarmingProgramResponse get(Long id) {
        FarmingProgram program = find(id);
        return response(program, cycleProgramRepository.countByProgramIdAndCycleStatus(id, CycleStatus.ACTIVE), null);
    }

    @Transactional
    public FarmingProgramResponse create(FarmingProgramRequest request) {
        return save(new FarmingProgram(), request);
    }

    @Transactional
    public FarmingProgramResponse update(Long id, FarmingProgramRequest request) {
        return save(find(id), request);
    }

    @Transactional
    public void delete(Long id) {
        FarmingProgram program = find(id);
        if (cycleProgramRepository.existsByProgramId(id)) {
            throw new ConflictException("Chương trình " + program.getName() + " đã được áp dụng cho lứa nuôi nên không thể xóa.",
                    "PROGRAM_IN_USE", null);
        }
        repository.delete(program);
    }

    /** Áp dụng chương trình nuôi cho lứa đang nuôi. */
    @Transactional
    public void attach(Long cycleId, Long programId) {
        FarmingCycle cycle = cycleService.requireActive(cycleId);
        FarmingProgram program = find(programId);
        if (cycleProgramRepository.existsByCycleIdAndProgramId(cycleId, programId)) {
            throw new ConflictException("Lứa nuôi đã áp dụng chương trình " + program.getName() + ".", "PROGRAM_ALREADY_ATTACHED", null);
        }
        CycleProgram link = new CycleProgram();
        link.setCycle(cycle);
        link.setProgram(program);
        cycleProgramRepository.save(link);
    }

    @Transactional
    public void detach(Long cycleId, Long programId) {
        cycleService.requireActive(cycleId);
        cycleProgramRepository.delete(cycleProgramRepository.findByCycleIdAndProgramId(cycleId, programId)
                .orElseThrow(() -> new ResourceNotFoundException("Lứa nuôi chưa áp dụng chương trình này.")));
    }

    private FarmingProgram find(Long id) {
        return repository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy chương trình nuôi."));
    }

    private FarmingProgramResponse save(FarmingProgram program, FarmingProgramRequest request) {
        String name = FarmAreaService.normalizeName(request.name());
        String key = name.toLowerCase(Locale.ROOT);
        boolean duplicate = program.getId() == null ? repository.existsByNameKey(key) : repository.existsByNameKeyAndIdNot(key, program.getId());
        if (duplicate) throw duplicateName();
        for (FarmingProgramRequest.Step step : request.steps()) {
            if (step.dayFrom() > step.dayTo()) {
                throw new BadRequestException("Nội dung \"" + step.name().strip() + "\": ngày tuổi bắt đầu phải nhỏ hơn hoặc bằng ngày tuổi kết thúc.",
                        "PROGRAM_STEP_RANGE");
            }
        }
        program.setName(name);
        program.setNameKey(key);
        program.setType(request.type());
        program.setDescription(clean(request.description()));
        program.getSteps().clear();
        for (FarmingProgramRequest.Step item : request.steps()) {
            FarmingProgramStep step = new FarmingProgramStep();
            step.setProgram(program);
            step.setName(item.name().strip());
            step.setDayFrom(item.dayFrom());
            step.setDayTo(item.dayTo());
            step.setQuantity(item.quantity());
            step.setUnit(item.unit() == null ? "" : item.unit().strip());
            step.setNote(clean(item.note()));
            program.getSteps().add(step);
        }
        try {
            FarmingProgram saved = repository.saveAndFlush(program);
            return response(saved, cycleProgramRepository.countByProgramIdAndCycleStatus(saved.getId(), CycleStatus.ACTIVE), null);
        } catch (DataIntegrityViolationException exception) {
            throw duplicateName();
        }
    }

    private ConflictException duplicateName() {
        return new ConflictException("Tên chương trình nuôi đã tồn tại.", "PROGRAM_DUPLICATE", "name");
    }

    /** currentDay (ngày tuổi của lứa) marks each step DONE / IN_PROGRESS / UPCOMING; null for plain templates. */
    static FarmingProgramResponse response(FarmingProgram program, long activeCycleCount, Integer currentDay) {
        List<ProgramStepResponse> steps = program.getSteps().stream().map(step -> new ProgramStepResponse(step.getId(), step.getName(),
                step.getDayFrom(), step.getDayTo(), step.getQuantity(), step.getUnit(), step.getNote(),
                currentDay == null ? null : currentDay > step.getDayTo() ? "DONE" : currentDay >= step.getDayFrom() ? "IN_PROGRESS" : "UPCOMING"))
                .toList();
        return new FarmingProgramResponse(program.getId(), String.format(Locale.ROOT, "CT%04d", program.getId()), program.getName(),
                program.getType(), program.getDescription(), steps, activeCycleCount);
    }
}
