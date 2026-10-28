package com.farmshift.backendFarmShift.service;

import com.farmshift.backendFarmShift.dto.request.InternalStockCategoryRequest;
import com.farmshift.backendFarmShift.dto.response.InternalStockCategoryResponse;
import com.farmshift.backendFarmShift.entity.InternalStockCategory;
import com.farmshift.backendFarmShift.exception.BadRequestException;
import com.farmshift.backendFarmShift.exception.ConflictException;
import com.farmshift.backendFarmShift.exception.ResourceNotFoundException;
import com.farmshift.backendFarmShift.repository.InternalStockCategoryRepository;
import com.farmshift.backendFarmShift.repository.InternalStockVoucherRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.text.Normalizer;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class InternalStockCategoryService {
    private final InternalStockCategoryRepository categoryRepository;
    private final InternalStockVoucherRepository voucherRepository;

    public List<InternalStockCategoryResponse> list() {
        return categoryRepository.findAllWithVoucherCount().stream()
                .map(row -> {
                    InternalStockCategory c = (InternalStockCategory) row[0];
                    long count = (Long) row[1];
                    return new InternalStockCategoryResponse(
                            c.getId(),
                            c.getMovementType(),
                            c.getName(),
                            c.getDescription(),
                            c.isSystem(),
                            count,
                            c.getCreatedAt()
                    );
                }).toList();
    }

    public InternalStockCategoryResponse get(Long id) {
        InternalStockCategory c = find(id);
        long count = voucherRepository.countByCategory_IdAndStatusNot(id, "CANCELLED");
        return new InternalStockCategoryResponse(
                c.getId(), c.getMovementType(), c.getName(), c.getDescription(), c.isSystem(), count, c.getCreatedAt()
        );
    }

    @Transactional
    public InternalStockCategoryResponse create(InternalStockCategoryRequest request) {
        String name = Normalizer.normalize(request.name().strip(), Normalizer.Form.NFC);
        String key = name.toLowerCase(Locale.ROOT);
        if (categoryRepository.existsByNameKey(key)) {
            throw new ConflictException("Tên danh mục phiếu đã tồn tại.", "INTERNAL_STOCK_CATEGORY_DUPLICATE", "name");
        }

        InternalStockCategory category = new InternalStockCategory();
        category.setMovementType(request.movementType());
        category.setName(name);
        category.setNameKey(key);
        category.setDescription(request.description() == null ? "" : request.description().strip());
        category.setSystem(false);

        try {
            category = categoryRepository.saveAndFlush(category);
            return new InternalStockCategoryResponse(
                    category.getId(), category.getMovementType(), category.getName(), category.getDescription(),
                    category.isSystem(), 0L, category.getCreatedAt()
            );
        } catch (DataIntegrityViolationException ex) {
            throw new ConflictException("Tên danh mục phiếu đã tồn tại.", "INTERNAL_STOCK_CATEGORY_DUPLICATE", "name");
        }
    }

    @Transactional
    public InternalStockCategoryResponse update(Long id, InternalStockCategoryRequest request) {
        InternalStockCategory category = find(id);
        long count = voucherRepository.countByCategory_IdAndStatusNot(id, "CANCELLED");

        if (count > 0 && !category.getMovementType().equals(request.movementType())) {
            throw new BadRequestException("Không thể đổi loại phiếu của danh mục đã có phiếu phát sinh.");
        }

        String name = Normalizer.normalize(request.name().strip(), Normalizer.Form.NFC);
        String key = name.toLowerCase(Locale.ROOT);
        if (categoryRepository.existsByNameKeyAndIdNot(key, id)) {
            throw new ConflictException("Tên danh mục phiếu đã tồn tại.", "INTERNAL_STOCK_CATEGORY_DUPLICATE", "name");
        }

        category.setMovementType(request.movementType());
        category.setName(name);
        category.setNameKey(key);
        category.setDescription(request.description() == null ? "" : request.description().strip());

        try {
            category = categoryRepository.saveAndFlush(category);
            return new InternalStockCategoryResponse(
                    category.getId(), category.getMovementType(), category.getName(), category.getDescription(),
                    category.isSystem(), count, category.getCreatedAt()
            );
        } catch (DataIntegrityViolationException ex) {
            throw new ConflictException("Tên danh mục phiếu đã tồn tại.", "INTERNAL_STOCK_CATEGORY_DUPLICATE", "name");
        }
    }

    @Transactional
    public void delete(Long id) {
        InternalStockCategory category = find(id);
        if (category.isSystem()) {
            throw new ConflictException("Không thể xóa danh mục mặc định của hệ thống.", "SYSTEM_CATEGORY_PROTECTED", null);
        }
        long count = voucherRepository.countByCategory_IdAndStatusNot(id, "CANCELLED");
        if (count > 0) {
            throw new ConflictException("Không thể xóa danh mục đã phát sinh phiếu xuất nhập.", "CATEGORY_IN_USE", null);
        }
        categoryRepository.delete(category);
    }

    public InternalStockCategory find(Long id) {
        return categoryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy danh mục xuất nhập nội bộ."));
    }
}
