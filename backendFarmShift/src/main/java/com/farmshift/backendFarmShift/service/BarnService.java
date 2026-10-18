package com.farmshift.backendFarmShift.service;

import com.farmshift.backendFarmShift.dto.request.BarnRequest;
import com.farmshift.backendFarmShift.dto.response.BarnResponse;
import com.farmshift.backendFarmShift.entity.Barn;
import com.farmshift.backendFarmShift.entity.BarnPurpose;
import com.farmshift.backendFarmShift.entity.BarnStatus;
import com.farmshift.backendFarmShift.entity.FarmArea;
import com.farmshift.backendFarmShift.exception.BadRequestException;
import com.farmshift.backendFarmShift.exception.ConflictException;
import com.farmshift.backendFarmShift.exception.ResourceNotFoundException;
import com.farmshift.backendFarmShift.repository.BarnRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class BarnService {
    private final BarnRepository repository;
    private final FarmAreaService areaService;

    public List<BarnResponse> list(Long areaId) {
        if (areaId == null) return repository.findAllByOrderByCreatedAtAscIdAsc().stream().map(this::response).toList();
        areaService.find(areaId);
        return repository.findAllByAreaIdOrderByCreatedAtAscIdAsc(areaId).stream().map(this::response).toList();
    }

    public BarnResponse get(Long id) { return response(find(id)); }

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
        repository.delete(barn);
    }

    private Barn find(Long id) {
        return repository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy chuồng."));
    }

    private BarnResponse save(Barn barn, BarnRequest request) {
        FarmArea area = areaService.find(request.areaId());
        validateQuantity(request);
        String name = FarmAreaService.normalizeName(request.name());
        String key = name.toLowerCase(Locale.ROOT);
        boolean duplicate = barn.getId() == null ? repository.existsByAreaIdAndNameKey(area.getId(), key)
                : repository.existsByAreaIdAndNameKeyAndIdNot(area.getId(), key, barn.getId());
        if (duplicate) throw duplicateName(area);
        barn.setArea(area);
        barn.setName(name);
        barn.setNameKey(key);
        barn.setPurpose(request.purpose());
        barn.setStatus(request.status());
        barn.setCapacity(request.capacity());
        barn.setCurrentQuantity(request.currentQuantity());
        barn.setTargetWeight(request.targetWeight());
        barn.setDescription(request.description() == null ? "" : request.description().strip());
        try {
            return response(repository.saveAndFlush(barn));
        } catch (DataIntegrityViolationException exception) {
            throw duplicateName(area);
        }
    }

    /** Animals may only live in an active farming barn, and never above its capacity. */
    private void validateQuantity(BarnRequest request) {
        int current = request.currentQuantity();
        if (current > request.capacity()) {
            throw new BadRequestException("Số con hiện có (" + current + ") vượt quá sức chứa tối đa (" + request.capacity() + ").",
                    "BARN_OVER_CAPACITY");
        }
        if (current > 0 && request.purpose() == BarnPurpose.BIO_TREATMENT) {
            throw new BadRequestException("Chuồng xử lý hóa sinh không chứa vật nuôi. Số con hiện có phải bằng 0.", "BARN_TREATMENT_NOT_EMPTY");
        }
        if (current > 0 && request.status() != BarnStatus.ACTIVE) {
            throw new BadRequestException("Chỉ chuồng đang hoạt động mới được có vật nuôi. Hãy chuyển hết vật nuôi trước khi đổi trạng thái.",
                    "BARN_INACTIVE_NOT_EMPTY");
        }
    }

    private ConflictException duplicateName(FarmArea area) {
        return new ConflictException("Tên chuồng đã tồn tại trong " + area.getName() + ".", "BARN_DUPLICATE", "name");
    }

    private BarnResponse response(Barn barn) {
        FarmArea area = barn.getArea();
        return new BarnResponse(barn.getId(), String.format(Locale.ROOT, "CH%06d", barn.getId()), area.getId(), area.getName(),
                barn.getName(), barn.getPurpose(), barn.getStatus(), barn.getCapacity(), barn.getCurrentQuantity(),
                barn.getTargetWeight(), barn.getDescription(), barn.getCreatedAt(), barn.getUpdatedAt());
    }
}
