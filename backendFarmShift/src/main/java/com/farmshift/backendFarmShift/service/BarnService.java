package com.farmshift.backendFarmShift.service;

import com.farmshift.backendFarmShift.dto.request.BarnRequest;
import com.farmshift.backendFarmShift.dto.response.BarnResponse;
import com.farmshift.backendFarmShift.entity.*;
import com.farmshift.backendFarmShift.exception.BadRequestException;
import com.farmshift.backendFarmShift.exception.ConflictException;
import com.farmshift.backendFarmShift.exception.ResourceNotFoundException;
import com.farmshift.backendFarmShift.repository.BarnRepository;
import com.farmshift.backendFarmShift.repository.FarmingCycleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class BarnService {
    private final BarnRepository repository;
    private final FarmAreaService areaService;
    private final FarmingCycleRepository cycleRepository;

    public List<BarnResponse> list(Long areaId) {
        List<Barn> barns = areaId == null ? repository.findAllByOrderByCreatedAtAscIdAsc()
                : repository.findAllByAreaIdOrderByCreatedAtAscIdAsc(areaService.find(areaId).getId());
        Map<Long, Long> activeCycles = cycleRepository.findAllByStatus(CycleStatus.ACTIVE).stream()
                .collect(Collectors.toMap(cycle -> cycle.getBarn().getId(), FarmingCycle::getId, (first, second) -> first));
        return barns.stream().map(barn -> response(barn, activeCycles.get(barn.getId()))).toList();
    }

    public BarnResponse get(Long id) {
        Barn barn = find(id);
        return response(barn, activeCycleId(id));
    }

    @Transactional
    public BarnResponse create(BarnRequest request) {
        return save(new Barn(), request);
    }

    @Transactional
    public BarnResponse update(Long id, BarnRequest request) {
        return save(find(id), request);
    }

    @Transactional
    public void delete(Long id) {
        Barn barn = find(id);
        if (barn.getCurrentQuantity() > 0) {
            throw new ConflictException("Chuồng " + barn.getName() + " đang nuôi " + barn.getCurrentQuantity()
                    + " con. Hãy xuất bán hoặc chuyển hết vật nuôi trước khi xóa chuồng.", "BARN_NOT_EMPTY", null);
        }
        if (cycleRepository.existsByBarnId(id)) {
            throw new ConflictException("Chuồng " + barn.getName() + " đã có lịch sử lứa nuôi nên không thể xóa. Hãy chuyển trạng thái sang Đã đóng.",
                    "BARN_HAS_CYCLES", null);
        }
        repository.delete(barn);
    }

    Barn find(Long id) {
        return repository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy chuồng."));
    }

    private Long activeCycleId(Long barnId) {
        return cycleRepository.findFirstByBarnIdAndStatus(barnId, CycleStatus.ACTIVE).map(FarmingCycle::getId).orElse(null);
    }

    private BarnResponse save(Barn barn, BarnRequest request) {
        FarmArea area = areaService.find(request.areaId());
        boolean creating = barn.getId() == null;
        Long activeCycle = creating ? null : activeCycleId(barn.getId());
        validate(barn, request, area, activeCycle);
        String name = FarmAreaService.normalizeName(request.name());
        String key = name.toLowerCase(Locale.ROOT);
        boolean duplicate = creating ? repository.existsByAreaIdAndNameKey(area.getId(), key)
                : repository.existsByAreaIdAndNameKeyAndIdNot(area.getId(), key, barn.getId());
        if (duplicate) throw duplicateName(area);
        barn.setArea(area);
        barn.setName(name);
        barn.setNameKey(key);
        barn.setPurpose(request.purpose());
        barn.setStatus(request.status());
        barn.setCapacity(request.capacity());
        barn.setAreaM2(request.areaM2());
        barn.setTargetWeight(request.targetWeight());
        barn.setDescription(request.description() == null ? "" : request.description().strip());
        try {
            return response(repository.saveAndFlush(barn), activeCycle);
        } catch (DataIntegrityViolationException exception) {
            throw duplicateName(area);
        }
    }

    /** A barn holding animals or running a cycle must stay an active farming barn in its area, with room for its stock. */
    private void validate(Barn barn, BarnRequest request, FarmArea area, Long activeCycle) {
        int current = barn.getCurrentQuantity();
        if (request.capacity() < current) {
            throw new BadRequestException("Sức chứa tối đa (" + request.capacity() + ") nhỏ hơn số con đang nuôi (" + current + ").",
                    "BARN_CAPACITY_BELOW_STOCK");
        }
        if (activeCycle == null) return;
        if (request.status() != BarnStatus.ACTIVE) {
            throw new BadRequestException("Chuồng đang có lứa nuôi nên phải ở trạng thái Đang hoạt động. Hãy kết thúc lứa trước.",
                    "BARN_ACTIVE_CYCLE_STATUS");
        }
        if (request.purpose() != BarnPurpose.FARMING) {
            throw new BadRequestException("Chuồng đang có lứa nuôi nên không thể đổi sang xử lý hóa sinh.", "BARN_ACTIVE_CYCLE_PURPOSE");
        }
        if (!barn.getArea().getId().equals(area.getId())) {
            throw new BadRequestException("Chuồng đang có lứa nuôi nên không thể chuyển sang khu khác.", "BARN_ACTIVE_CYCLE_MOVE");
        }
    }

    private ConflictException duplicateName(FarmArea area) {
        return new ConflictException("Tên chuồng đã tồn tại trong " + area.getName() + ".", "BARN_DUPLICATE", "name");
    }

    static BarnResponse response(Barn barn, Long activeCycleId) {
        FarmArea area = barn.getArea();
        return new BarnResponse(barn.getId(), String.format(Locale.ROOT, "CH%06d", barn.getId()), area.getId(), area.getName(),
                area.getLivestockType(), barn.getName(), barn.getPurpose(), barn.getStatus(), barn.getCapacity(),
                barn.getCurrentQuantity(), barn.getAreaM2(), barn.getTargetWeight(), barn.getDescription(), activeCycleId,
                barn.getCreatedAt(), barn.getUpdatedAt());
    }
}
