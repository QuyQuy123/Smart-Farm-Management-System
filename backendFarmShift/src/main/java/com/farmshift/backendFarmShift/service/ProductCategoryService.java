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
    private final com.farmshift.backendFarmShift.repository.InventoryItemRepository inventory;
    private final com.farmshift.backendFarmShift.repository.WarehouseCategoryRepository warehouseRepository;

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
    public void delete(Long id) {
        var product = find(id);
        if (inventory.existsByProduct_Id(id)) throw new ConflictException("Không thể xóa tên hàng hóa đang có trong kho.", "PRODUCT_IN_USE", null);
        repository.delete(product);
    }

    private ProductCategory find(Long id) {
        return repository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tên hàng hóa."));
    }

    private ProductCategoryResponse save(ProductCategory category, ProductCategoryRequest request) {
        if (category.getId() != null && category.getWarehouse() != null && !category.getWarehouse().getId().equals(request.warehouseId()) && inventory.existsByProduct_Id(category.getId())) {
            throw new ConflictException("Không thể chuyển tên hàng hóa đã có hàng trong kho sang kho khác.", "PRODUCT_IN_USE", "warehouseId");
        }
        String name = Normalizer.normalize(request.name().strip(), Normalizer.Form.NFC);
        String key = name.toLowerCase(Locale.ROOT);
        boolean duplicate = category.getId() == null ? repository.existsByNameKey(key)
                : repository.existsByNameKeyAndIdNot(key, category.getId());
        if (duplicate) throw duplicateName();
        category.setName(name);
        category.setNameKey(key);
        category.setDescription(request.description() == null ? "" : request.description().strip());
        category.setSpecification(request.specification() == null ? "" : request.specification().strip());
        category.setBrand(request.brand() == null ? "" : request.brand().strip());
        category.setProductType(request.productType() == null ? "" : request.productType().strip());
        category.setWarehouse(warehouseRepository.findById(request.warehouseId())
                .orElseThrow(() -> new ResourceNotFoundException("Kho đã chọn không tồn tại. Vui lòng chọn lại.")));
        try {
            return response(repository.saveAndFlush(category));
        } catch (DataIntegrityViolationException exception) {
            throw duplicateName();
        }
    }

    private ConflictException duplicateName() {
        return new ConflictException("Tên hàng hóa đã tồn tại.", "PRODUCT_CATEGORY_DUPLICATE", "name");
    }

    private ProductCategoryResponse response(ProductCategory category) {
        return new ProductCategoryResponse(category.getId(), String.format(Locale.ROOT, "HH%06d", category.getId()),
                category.getName(), category.getDescription(),
                category.getSpecification(), category.getBrand(), category.getProductType(),
                inventory.countByProduct_Id(category.getId()), category.getCreatedAt(),
                category.getWarehouse() == null ? null : category.getWarehouse().getId(),
                category.getWarehouse() == null ? null : category.getWarehouse().getName());
    }
}
