package com.farmshift.backendFarmShift.service;
import com.farmshift.backendFarmShift.entity.TransferCategory;
import com.farmshift.backendFarmShift.repository.TransferCategoryRepository;
import com.farmshift.backendFarmShift.dto.request.TransferCategoryRequest;
import com.farmshift.backendFarmShift.dto.response.TransferCategoryResponse;
import com.farmshift.backendFarmShift.exception.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.Sort;
import org.springframework.dao.DataIntegrityViolationException;
import java.util.*;
import java.text.Normalizer;
@Service @RequiredArgsConstructor @Transactional(readOnly=true)
public class TransferCategoryService {
    private final TransferCategoryRepository repository;
    public List<TransferCategoryResponse> list() { return repository.findAll(Sort.by("createdAt", "id")).stream().map(this::response).toList(); }
    public TransferCategoryResponse get(Long id) { return response(find(id)); }
    @Transactional public TransferCategoryResponse create(TransferCategoryRequest request) { return save(new TransferCategory(), request); }
    @Transactional public TransferCategoryResponse update(Long id, TransferCategoryRequest request) { return save(find(id), request); }
    @Transactional public void delete(Long id) { repository.delete(find(id)); }
    private TransferCategory find(Long id) { return repository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy danh mục phiếu.")); }
    private ConflictException duplicate() { return new ConflictException("Tên danh mục đã tồn tại trong loại phiếu này.", "TRANSFER_CATEGORY_DUPLICATE", "name"); }
    private TransferCategoryResponse save(TransferCategory item, TransferCategoryRequest request) {
        String type=Normalizer.normalize(request.type().strip(), Normalizer.Form.NFC);
        String name=Normalizer.normalize(request.name().strip(), Normalizer.Form.NFC), key=name.toLowerCase(Locale.ROOT);
        if(repository.existsByTypeAndNameKeyAndIdNot(type, key, item.getId()==null ? -1L : item.getId())) throw duplicate();
        item.setType(type); item.setName(name); item.setNameKey(key); item.setDescription(request.description()==null ? "" : request.description().strip());
        try { return response(repository.saveAndFlush(item)); } catch(DataIntegrityViolationException e) { throw duplicate(); }
    }
    // Transfer slips currently exist only in the frontend; no persisted slips to count yet.
    private TransferCategoryResponse response(TransferCategory item) { return new TransferCategoryResponse(item.getId(), item.getType(), item.getName(), item.getDescription(), 0, item.getCreatedAt()); }
}
