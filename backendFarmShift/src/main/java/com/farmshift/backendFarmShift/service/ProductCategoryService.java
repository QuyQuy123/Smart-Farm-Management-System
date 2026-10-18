package com.farmshift.backendFarmShift.service;

import com.farmshift.backendFarmShift.dto.request.ProductCategoryRequest;
import com.farmshift.backendFarmShift.dto.response.ProductCategoryResponse;
import com.farmshift.backendFarmShift.entity.ProductCategory;
import com.farmshift.backendFarmShift.exception.ConflictException;
import com.farmshift.backendFarmShift.exception.ResourceNotFoundException;
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
public class ProductCategoryService {
    private final ProductCategoryRepository repository;

    public List<ProductCategoryResponse> list() {
        return repository.findAll(Sort.by(Sort.Direction.ASC, "createdAt", "id")).stream().map(this::response).toList();
    }

    public ProductCategoryResponse get(Long id) { return response(find(id)); }

    @Transactional
    public ProductCategoryResponse create(ProductCategoryRequest request) {
        return save(new ProductCategory(), request);
    }

    @Transactional
    public ProductCategoryResponse update(Long id, ProductCategoryRequest request) {
        return save(find(id), request);
    }

    @Transactional
    public void delete(Long id) { repository.delete(find(id)); }

    private ProductCategory find(Long id) {
        return repository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy danh mục hàng hóa."));
    }

    private ProductCategoryResponse save(ProductCategory category, ProductCategoryRequest request) {
        String name = Normalizer.normalize(request.name().strip(), Normalizer.Form.NFC);
        String key = name.toLowerCase(Locale.ROOT);
        boolean duplicate = category.getId() == null ? repository.existsByNameKey(key)
                : repository.existsByNameKeyAndIdNot(key, category.getId());
        if (duplicate) throw duplicateName();
        category.setName(name);
        category.setNameKey(key);
        category.setDescription(request.description() == null ? "" : request.description().strip());
        try {
            return response(repository.saveAndFlush(category));
        } catch (DataIntegrityViolationException exception) {
            throw duplicateName();
        }
    }

    private ConflictException duplicateName() {
        return new ConflictException("Tên danh mục hàng hóa đã tồn tại.", "PRODUCT_CATEGORY_DUPLICATE", "name");
    }

    private ProductCategoryResponse response(ProductCategory category) {
        // No inventory-item entity exists yet; derive the count from that relationship when it is added.
        return new ProductCategoryResponse(category.getId(), String.format(Locale.ROOT, "HH%06d", category.getId()),
                category.getName(), category.getDescription(), 0L, category.getCreatedAt());
    }
}
