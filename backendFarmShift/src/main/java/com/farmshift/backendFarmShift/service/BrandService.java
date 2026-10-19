package com.farmshift.backendFarmShift.service;

import com.farmshift.backendFarmShift.dto.request.BrandRequest;
import com.farmshift.backendFarmShift.dto.response.BrandResponse;
import com.farmshift.backendFarmShift.entity.Brand;
import com.farmshift.backendFarmShift.exception.ConflictException;
import com.farmshift.backendFarmShift.exception.ResourceNotFoundException;
import com.farmshift.backendFarmShift.repository.BrandRepository;
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
public class BrandService {
    private final BrandRepository repository;
    private final com.farmshift.backendFarmShift.repository.InventoryItemRepository inventory;

    public List<BrandResponse> list() {
        return repository.findAll(Sort.by(Sort.Direction.ASC, "createdAt", "id")).stream().map(this::response).toList();
    }

    public BrandResponse get(Long id) {
        return response(find(id));
    }

    @Transactional
    public BrandResponse create(BrandRequest request) {
        return save(new Brand(), request);
    }

    @Transactional
    public BrandResponse update(Long id, BrandRequest request) {
        return save(find(id), request);
    }

    @Transactional
    public void delete(Long id) {
        var brand = find(id);
        if (inventory.existsByBrand_Id(id)) throw new ConflictException("Không thể xóa nhãn hiệu đang được hàng hóa sử dụng.", "BRAND_IN_USE", null);
        repository.delete(brand);
    }

    private Brand find(Long id) {
        return repository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy nhãn hiệu."));
    }

    private BrandResponse save(Brand brand, BrandRequest request) {
        String name = Normalizer.normalize(request.name().strip(), Normalizer.Form.NFC);
        String key = name.toLowerCase(Locale.ROOT);
        boolean duplicate = brand.getId() == null ? repository.existsByNameKey(key)
                : repository.existsByNameKeyAndIdNot(key, brand.getId());
        if (duplicate) throw duplicateName();

        brand.setName(name);
        brand.setNameKey(key);
        brand.setProductType(request.productType() == null ? "" : request.productType().strip());
        brand.setQuantity(request.quantity() != null ? request.quantity() : 0);
        brand.setNote(request.note() == null ? "" : request.note().strip());

        try {
            return response(repository.saveAndFlush(brand));
        } catch (DataIntegrityViolationException exception) {
            throw duplicateName();
        }
    }

    private ConflictException duplicateName() {
        return new ConflictException("Tên nhãn hiệu đã tồn tại.", "BRAND_DUPLICATE", "name");
    }

    private BrandResponse response(Brand brand) {
        return new BrandResponse(
                brand.getId(),
                String.format(Locale.ROOT, "NH%06d", brand.getId()),
                brand.getName(),
                brand.getProductType(),
                brand.getQuantity() != null ? brand.getQuantity() : 0,
                brand.getNote(),
                brand.getCreatedAt(),
                brand.getUpdatedAt()
        );
    }
}
