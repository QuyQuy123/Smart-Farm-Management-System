package com.farmshift.backendFarmShift.service;

import com.farmshift.backendFarmShift.dto.request.WarehouseCategoryRequest;
import com.farmshift.backendFarmShift.dto.response.WarehouseCategoryResponse;
import com.farmshift.backendFarmShift.entity.WarehouseCategory;
import com.farmshift.backendFarmShift.exception.ConflictException;
import com.farmshift.backendFarmShift.exception.ResourceNotFoundException;
import com.farmshift.backendFarmShift.repository.WarehouseCategoryRepository;
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
public class WarehouseCategoryService {
    private final WarehouseCategoryRepository repository;
    private final com.farmshift.backendFarmShift.repository.InventoryItemRepository inventory;
    private final com.farmshift.backendFarmShift.repository.ProductCategoryRepository productCategoryRepository;

    public List<WarehouseCategoryResponse> list() {
        return repository.findAll(Sort.by(Sort.Direction.ASC, "createdAt", "id")).stream().map(this::response).toList();
    }

    public WarehouseCategoryResponse get(Long id) { return response(find(id)); }

    @Transactional
    public WarehouseCategoryResponse create(WarehouseCategoryRequest request) {
        return save(new WarehouseCategory(), request);
    }

    @Transactional
    public WarehouseCategoryResponse update(Long id, WarehouseCategoryRequest request) {
        return save(find(id), request);
    }

    @Transactional
    public void delete(Long id) {
        var warehouse = find(id);
        if (productCategoryRepository.existsByWarehouse_Id(id) || inventory.existsByWarehouse_Id(id)) {
            throw new ConflictException("Không thể xóa kho đang chứa hàng hóa. Hãy chuyển hoặc xóa các hàng hóa liên quan trước.", "WAREHOUSE_IN_USE", null);
        }
        repository.delete(warehouse);
    }

    private WarehouseCategory find(Long id) {
        return repository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy danh mục kho."));
    }

    private WarehouseCategoryResponse save(WarehouseCategory category, WarehouseCategoryRequest request) {
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
        return new ConflictException("Tên danh mục kho đã tồn tại.", "WAREHOUSE_CATEGORY_DUPLICATE", "name");
    }

    private WarehouseCategoryResponse response(WarehouseCategory category) {
        return new WarehouseCategoryResponse(category.getId(), String.format(Locale.ROOT, "DM%06d", category.getId()),
                category.getName(), category.getDescription(), inventory.countByWarehouse_Id(category.getId()), category.getCreatedAt());
    }
}
