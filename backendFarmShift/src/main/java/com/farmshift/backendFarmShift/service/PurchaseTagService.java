package com.farmshift.backendFarmShift.service;

import com.farmshift.backendFarmShift.dto.request.PurchaseTagRequest;
import com.farmshift.backendFarmShift.dto.response.PurchaseTagResponse;
import com.farmshift.backendFarmShift.entity.PurchaseTag;
import com.farmshift.backendFarmShift.exception.ConflictException;
import com.farmshift.backendFarmShift.exception.ResourceNotFoundException;
import com.farmshift.backendFarmShift.repository.PurchaseTagRepository;
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
public class PurchaseTagService {
    private final PurchaseTagRepository repository;

    public List<PurchaseTagResponse> list() {
        return repository.findAll(Sort.by("createdAt", "id")).stream().map(this::toResponse).toList();
    }

    public PurchaseTagResponse get(Long id) {
        return toResponse(find(id));
    }

    @Transactional
    public PurchaseTagResponse create(PurchaseTagRequest request) {
        return save(new PurchaseTag(), request);
    }

    @Transactional
    public PurchaseTagResponse update(Long id, PurchaseTagRequest request) {
        return save(find(id), request);
    }

    @Transactional
    public void delete(Long id) {
        repository.delete(find(id));
    }

    private PurchaseTag find(Long id) {
        return repository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy thẻ phân loại."));
    }

    private PurchaseTagResponse save(PurchaseTag tag, PurchaseTagRequest request) {
        String name = Normalizer.normalize(request.name().strip(), Normalizer.Form.NFC);
        String key = name.toLowerCase(Locale.ROOT);
        if (repository.existsByNameKeyAndIdNot(key, tag.getId() == null ? -1L : tag.getId())) {
            throw new ConflictException("Tên thẻ phân loại đã tồn tại.", "PURCHASE_TAG_DUPLICATE", "name");
        }
        tag.setName(name);
        tag.setNameKey(key);
        tag.setColor(request.color().strip());
        tag.setDescription(request.description() == null ? "" : request.description().strip());

        try {
            return toResponse(repository.saveAndFlush(tag));
        } catch (DataIntegrityViolationException exception) {
            throw new ConflictException("Tên thẻ phân loại đã tồn tại.", "PURCHASE_TAG_DUPLICATE", "name");
        }
    }

    private PurchaseTagResponse toResponse(PurchaseTag tag) {
        long usageCount = tag.getId() != null ? repository.countUsage(tag.getId()) : 0L;
        return new PurchaseTagResponse(
                tag.getId(),
                tag.getName(),
                tag.getColor(),
                tag.getDescription(),
                usageCount,
                tag.getCreatedAt()
        );
    }
}
