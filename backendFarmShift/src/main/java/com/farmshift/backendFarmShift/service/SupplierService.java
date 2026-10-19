package com.farmshift.backendFarmShift.service;

import com.farmshift.backendFarmShift.dto.request.SupplierRequest;
import com.farmshift.backendFarmShift.dto.response.SupplierResponse;
import com.farmshift.backendFarmShift.entity.Supplier;
import com.farmshift.backendFarmShift.exception.ConflictException;
import com.farmshift.backendFarmShift.exception.ResourceNotFoundException;
import com.farmshift.backendFarmShift.repository.SupplierRepository;
import com.farmshift.backendFarmShift.repository.ProductTypeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.text.Normalizer;
import java.util.List;
import java.util.Locale;

@Service @RequiredArgsConstructor @Transactional(readOnly = true)
public class SupplierService {
    private final SupplierRepository repository;
    private final ProductTypeRepository productTypes;
    public List<SupplierResponse> list() { return repository.findAll(Sort.by("createdAt", "id")).stream().map(this::response).toList(); }
    public SupplierResponse get(Long id) { return response(find(id)); }
    @Transactional
    public SupplierResponse create(SupplierRequest request) { return save(new Supplier(), request); }
    @Transactional
    public SupplierResponse update(Long id, SupplierRequest request) { return save(find(id), request); }
    @Transactional
    public void delete(Long id) { repository.delete(find(id)); }
    private Supplier find(Long id) { return repository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy nhà cung cấp.")); }
    private SupplierResponse save(Supplier supplier, SupplierRequest request) {
        String name = Normalizer.normalize(request.name().strip(), Normalizer.Form.NFC);
        String key = name.toLowerCase(Locale.ROOT);
        if (repository.existsByNameKeyAndIdNot(key, supplier.getId() == null ? -1L : supplier.getId())) throw duplicate();
        supplier.setName(name); supplier.setNameKey(key);
        supplier.setRepresentative(request.representative().strip()); supplier.setPhone(request.phone().strip());
        supplier.setProductType(productTypes.findById(request.productTypeId()).orElseThrow(() -> new ResourceNotFoundException("Nhóm nhà cung cấp đã chọn không tồn tại. Vui lòng chọn lại.")));
        try { return response(repository.saveAndFlush(supplier)); }
        catch (DataIntegrityViolationException exception) { throw duplicate(); }
    }
    private ConflictException duplicate() { return new ConflictException("Đơn vị cung cấp đã tồn tại.", "SUPPLIER_DUPLICATE", "name"); }
    private SupplierResponse response(Supplier supplier) {
        return new SupplierResponse(supplier.getId(), supplier.getName(), supplier.getRepresentative(), supplier.getPhone(),
                supplier.getProductType().getId(), supplier.getProductType().getName(), supplier.getCreatedAt());
    }
}
