package com.farmshift.backendFarmShift.service;

import com.farmshift.backendFarmShift.dto.request.MeasurementUnitRequest;
import com.farmshift.backendFarmShift.dto.response.MeasurementUnitResponse;
import com.farmshift.backendFarmShift.entity.MeasurementUnit;
import com.farmshift.backendFarmShift.exception.ConflictException;
import com.farmshift.backendFarmShift.exception.ResourceNotFoundException;
import com.farmshift.backendFarmShift.repository.MeasurementUnitRepository;
import com.farmshift.backendFarmShift.repository.ProductCategoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.text.Normalizer;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MeasurementUnitService {
    private final MeasurementUnitRepository repository;
    private final ProductCategoryRepository products;

    public List<MeasurementUnitResponse> list() {
        return repository.findAll(Sort.by("createdAt", "id")).stream().map(this::response).toList();
    }
    public MeasurementUnitResponse get(Long id) { return response(find(id)); }
    @Transactional
    public MeasurementUnitResponse create(MeasurementUnitRequest request) { return save(new MeasurementUnit(), request); }
    @Transactional
    public MeasurementUnitResponse update(Long id, MeasurementUnitRequest request) { return save(find(id), request); }
    @Transactional
    public void delete(Long id) {
        var unit = find(id);
        if (products.countByUnitName(unit.getName()) > 0) throw new ConflictException("Không thể xóa đơn vị đang có hàng hóa sử dụng.", "UNIT_IN_USE", null);
        repository.delete(unit);
    }
    private MeasurementUnit find(Long id) {
        return repository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn vị tính."));
    }
    private String clean(String value) { return Normalizer.normalize(value.strip(), Normalizer.Form.NFC); }
    private MeasurementUnitResponse save(MeasurementUnit unit, MeasurementUnitRequest request) {
        String code = clean(request.code()), name = clean(request.name());
        String codeKey = code.toLowerCase(Locale.ROOT), nameKey = name.toLowerCase(Locale.ROOT);
        Long excludedId = unit.getId() == null ? -1L : unit.getId();
        if (repository.existsByCodeKeyAndIdNot(codeKey, excludedId)) throw new ConflictException("Mã đơn vị đã tồn tại.", "UNIT_CODE_DUPLICATE", "code");
        if (repository.existsByNameKeyAndIdNot(nameKey, excludedId)) throw new ConflictException("Tên đơn vị đã tồn tại.", "UNIT_NAME_DUPLICATE", "name");
        String oldName = unit.getName();
        unit.setCode(code); unit.setCodeKey(codeKey); unit.setName(name); unit.setNameKey(nameKey);
        unit.setDescription(request.description() == null ? "" : request.description().strip());
        try { unit = repository.saveAndFlush(unit); }
        catch (DataIntegrityViolationException exception) { throw new ConflictException("Mã hoặc tên đơn vị đã tồn tại.", "UNIT_DUPLICATE", null); }
        if (oldName != null && !oldName.equals(name)) products.renameUnitSpecifications(oldName, name);
        return response(unit);
    }
    private MeasurementUnitResponse response(MeasurementUnit unit) {
        return new MeasurementUnitResponse(unit.getId(), unit.getCode(), unit.getName(), unit.getDescription(), products.countByUnitName(unit.getName()), unit.getCreatedAt());
    }
}
