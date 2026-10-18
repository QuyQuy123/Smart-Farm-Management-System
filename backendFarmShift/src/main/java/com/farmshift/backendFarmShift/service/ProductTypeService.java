package com.farmshift.backendFarmShift.service;

import com.farmshift.backendFarmShift.dto.request.ProductTypeRequest;
import com.farmshift.backendFarmShift.dto.response.ProductTypeResponse;
import com.farmshift.backendFarmShift.entity.ProductType;
import com.farmshift.backendFarmShift.exception.ConflictException;
import com.farmshift.backendFarmShift.exception.ResourceNotFoundException;
import com.farmshift.backendFarmShift.repository.ProductTypeRepository;
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
public class ProductTypeService {
    private final ProductTypeRepository repository;

    public List<ProductTypeResponse> list() {
        return repository.findAll(Sort.by(Sort.Direction.ASC, "createdAt", "id")).stream().map(this::response).toList();
    }

    public ProductTypeResponse get(Long id) {
        return response(find(id));
    }

    @Transactional
    public ProductTypeResponse create(ProductTypeRequest request) {
        return save(new ProductType(), request);
    }

    @Transactional
    public ProductTypeResponse update(Long id, ProductTypeRequest request) {
        return save(find(id), request);
    }

    @Transactional
    public void delete(Long id) {
        repository.delete(find(id));
    }

    private ProductType find(Long id) {
        return repository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy loại hàng hóa."));
    }

    private ProductTypeResponse save(ProductType type, ProductTypeRequest request) {
        String name = Normalizer.normalize(request.name().strip(), Normalizer.Form.NFC);
        String key = name.toLowerCase(Locale.ROOT);
        boolean duplicate = type.getId() == null ? repository.existsByNameKey(key)
                : repository.existsByNameKeyAndIdNot(key, type.getId());
        if (duplicate) throw duplicateName();

        type.setName(name);
        type.setNameKey(key);
        type.setDescription(request.description() == null ? "" : request.description().strip());
        type.setQuantity(request.quantity() != null ? request.quantity() : 0);

        try {
            ProductType saved = repository.saveAndFlush(type);
            if (saved.getCode() == null || saved.getCode().isBlank()) {
                saved.setCode(String.format(Locale.ROOT, "LH%06d", saved.getId()));
                saved = repository.saveAndFlush(saved);
            }
            return response(saved);
        } catch (DataIntegrityViolationException exception) {
            throw duplicateName();
        }
    }

    private ConflictException duplicateName() {
        return new ConflictException("Tên loại hàng đã tồn tại.", "PRODUCT_TYPE_DUPLICATE", "name");
    }

    private ProductTypeResponse response(ProductType type) {
        String code = type.getCode() != null && !type.getCode().isBlank()
                ? type.getCode()
                : String.format(Locale.ROOT, "LH%06d", type.getId());
        return new ProductTypeResponse(
                type.getId(),
                code,
                type.getName(),
                type.getDescription(),
                type.getQuantity() != null ? type.getQuantity() : 0,
                type.getCreatedAt(),
                type.getUpdatedAt()
        );
    }
}
