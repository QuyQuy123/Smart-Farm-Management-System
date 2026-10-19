package com.farmshift.backendFarmShift.service;

import com.farmshift.backendFarmShift.dto.request.SupplierRequest;
import com.farmshift.backendFarmShift.dto.response.SupplierResponse;
import com.farmshift.backendFarmShift.entity.ProductType;
import com.farmshift.backendFarmShift.entity.PurchaseTag;
import com.farmshift.backendFarmShift.entity.Supplier;
import com.farmshift.backendFarmShift.exception.ConflictException;
import com.farmshift.backendFarmShift.exception.ResourceNotFoundException;
import com.farmshift.backendFarmShift.repository.ProductTypeRepository;
import com.farmshift.backendFarmShift.repository.PurchaseInvoiceRepository;
import com.farmshift.backendFarmShift.repository.PurchaseTagRepository;
import com.farmshift.backendFarmShift.repository.SupplierRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SupplierService {
    private final SupplierRepository repository;
    private final ProductTypeRepository productTypes;
    private final PurchaseTagRepository tagRepository;
    private final PurchaseInvoiceRepository invoiceRepository;

    public List<SupplierResponse> list() {
        return repository.findAll(Sort.by("createdAt", "id")).stream().map(this::response).toList();
    }

    public SupplierResponse get(Long id) {
        return response(find(id));
    }

    @Transactional
    public SupplierResponse create(SupplierRequest request) {
        return save(new Supplier(), request);
    }

    @Transactional
    public SupplierResponse update(Long id, SupplierRequest request) {
        return save(find(id), request);
    }

    @Transactional
    public void delete(Long id) {
        repository.delete(find(id));
    }

    private Supplier find(Long id) {
        return repository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy nhà cung cấp."));
    }

    private SupplierResponse save(Supplier supplier, SupplierRequest request) {
        String name = Normalizer.normalize(request.name().strip(), Normalizer.Form.NFC);
        String key = name.toLowerCase(Locale.ROOT);
        if (repository.existsByNameKeyAndIdNot(key, supplier.getId() == null ? -1L : supplier.getId())) {
            throw duplicate();
        }
        supplier.setName(name);
        supplier.setNameKey(key);
        supplier.setRepresentative(request.representative().strip());
        supplier.setPhone(request.phone().strip());
        ProductType pt = null;
        if (request.productTypeId() != null) {
            pt = productTypes.findById(request.productTypeId()).orElse(null);
        }
        if (pt == null) {
            List<ProductType> allTypes = productTypes.findAll();
            if (allTypes.isEmpty()) {
                ProductType defaultPt = new ProductType();
                defaultPt.setCode("LH000001");
                defaultPt.setName("Thức ăn chăn nuôi");
                defaultPt.setNameKey("thức ăn chăn nuôi");
                defaultPt.setDescription("Cám gà các giai đoạn");
                defaultPt.setQuantity(0);
                pt = productTypes.save(defaultPt);
            } else if (request.productTypeId() == null) {
                pt = allTypes.get(0);
            } else {
                throw new ResourceNotFoundException("Nhóm nhà cung cấp đã chọn không tồn tại. Vui lòng chọn lại.");
            }
        }
        supplier.setProductType(pt);

        if (request.email() != null) supplier.setEmail(request.email().strip());
        if (request.address() != null) supplier.setAddress(request.address().strip());
        if (request.taxCode() != null) supplier.setTaxCode(request.taxCode().strip());
        if (request.bankName() != null) supplier.setBankName(request.bankName().strip());
        if (request.bankAccount() != null) supplier.setBankAccount(request.bankAccount().strip());
        if (request.paymentPolicy() != null) supplier.setPaymentPolicy(request.paymentPolicy().strip());
        if (request.openingDebt() != null) supplier.setOpeningDebt(request.openingDebt());
        if (request.note() != null) supplier.setNote(request.note().strip());

        if (request.tagIds() != null) {
            Set<PurchaseTag> tags = new HashSet<>(tagRepository.findAllById(request.tagIds()));
            supplier.setTags(tags);
        }

        try {
            return response(repository.saveAndFlush(supplier));
        } catch (DataIntegrityViolationException exception) {
            throw duplicate();
        }
    }

    private ConflictException duplicate() {
        return new ConflictException("Đơn vị cung cấp đã tồn tại.", "SUPPLIER_DUPLICATE", "name");
    }

    private SupplierResponse response(Supplier supplier) {
        List<Long> tagIds = supplier.getTags() == null ? List.of() : supplier.getTags().stream().map(PurchaseTag::getId).toList();
        List<String> tagNames = supplier.getTags() == null ? List.of() : supplier.getTags().stream().map(PurchaseTag::getName).toList();

        Long totalPurchased = invoiceRepository.calculateTotalPurchasedBySupplier(supplier.getId());
        Long currentDebt = invoiceRepository.calculateCurrentDebtBySupplier(supplier.getId());
        long openingDebt = supplier.getOpeningDebt() != null ? supplier.getOpeningDebt() : 0L;
        long totalDebt = openingDebt + (currentDebt != null ? currentDebt : 0L);

        return new SupplierResponse(
                supplier.getId(),
                supplier.getName(),
                supplier.getRepresentative(),
                supplier.getPhone(),
                supplier.getProductType().getId(),
                supplier.getProductType().getName(),
                supplier.getCreatedAt(),
                supplier.getEmail(),
                supplier.getAddress(),
                supplier.getTaxCode(),
                supplier.getBankName(),
                supplier.getBankAccount(),
                supplier.getPaymentPolicy(),
                supplier.getOpeningDebt(),
                supplier.getNote(),
                tagIds,
                tagNames,
                totalPurchased != null ? totalPurchased : 0L,
                totalDebt
        );
    }
}
