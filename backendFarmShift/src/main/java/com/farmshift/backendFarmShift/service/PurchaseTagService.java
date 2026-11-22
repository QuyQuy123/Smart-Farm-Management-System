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
        List<PurchaseTag> tags = repository.findAll(Sort.by("createdAt", "id"));
        if (tags.isEmpty()) {
            return List.of();
        }
        java.util.Map<Long, Long> usageByTag = new java.util.HashMap<>();
        for (Object[] row : repository.countSupplierUsageByTag()) {
            if (row != null && row.length >= 2 && row[0] instanceof Number idNum && row[1] instanceof Number cntNum) {
                usageByTag.merge(idNum.longValue(), cntNum.longValue(), Long::sum);
            }
        }
        for (Object[] row : repository.countInvoiceUsageByTag()) {
            if (row != null && row.length >= 2 && row[0] instanceof Number idNum && row[1] instanceof Number cntNum) {
                usageByTag.merge(idNum.longValue(), cntNum.longValue(), Long::sum);
            }
        }
        return tags.stream()
                .map(t -> toResponse(t, usageByTag.getOrDefault(t.getId(), 0L)))
                .toList();
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
        return toResponse(tag, usageCount);
    }

    private PurchaseTagResponse toResponse(PurchaseTag tag, long usageCount) {
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
