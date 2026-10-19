package com.farmshift.backendFarmShift.service;

import com.farmshift.backendFarmShift.dto.request.SpecificationRequest;
import com.farmshift.backendFarmShift.dto.response.SpecificationResponse;
import com.farmshift.backendFarmShift.entity.Specification;
import com.farmshift.backendFarmShift.exception.ConflictException;
import com.farmshift.backendFarmShift.exception.ResourceNotFoundException;
import com.farmshift.backendFarmShift.repository.SpecificationRepository;
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
public class SpecificationService {
    private final SpecificationRepository repository;

    public List<SpecificationResponse> list() {
        return repository.findAll(Sort.by(Sort.Direction.ASC, "createdAt", "id")).stream().map(this::response).toList();
    }

    public SpecificationResponse get(Long id) {
        return response(find(id));
    }

    @Transactional
    public SpecificationResponse create(SpecificationRequest request) {
        return save(new Specification(), request);
    }

    @Transactional
    public SpecificationResponse update(Long id, SpecificationRequest request) {
        return save(find(id), request);
    }

    @Transactional
    public void delete(Long id) {
        repository.delete(find(id));
    }

    private Specification find(Long id) {
        return repository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy quy cách."));
    }

    private SpecificationResponse save(Specification spec, SpecificationRequest request) {
        String name = Normalizer.normalize(request.name().strip(), Normalizer.Form.NFC);
        String key = name.toLowerCase(Locale.ROOT);
        boolean duplicate = spec.getId() == null ? repository.existsByNameKey(key)
                : repository.existsByNameKeyAndIdNot(key, spec.getId());
        if (duplicate) throw duplicateName();

        spec.setName(name);
        spec.setNameKey(key);
        spec.setUnit(request.unit() == null ? "" : request.unit().strip());
        spec.setItems(request.items() == null ? "" : request.items().strip());
        spec.setNote(request.note() == null ? "" : request.note().strip());

        try {
            return response(repository.saveAndFlush(spec));
        } catch (DataIntegrityViolationException exception) {
            throw duplicateName();
        }
    }

    private ConflictException duplicateName() {
        return new ConflictException("Tên quy cách đã tồn tại.", "SPECIFICATION_DUPLICATE", "name");
    }

    private SpecificationResponse response(Specification spec) {
        return new SpecificationResponse(
                spec.getId(),
                spec.getName(),
                spec.getUnit(),
                spec.getItems(),
                spec.getNote(),
                spec.getCreatedAt(),
                spec.getUpdatedAt()
        );
    }
}
