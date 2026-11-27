package com.farmshift.backendFarmShift.service;

import com.farmshift.backendFarmShift.dto.request.InventoryItemRequest;
import com.farmshift.backendFarmShift.dto.response.InventoryItemResponse;
import com.farmshift.backendFarmShift.entity.InventoryItem;
import com.farmshift.backendFarmShift.exception.BadRequestException;
import com.farmshift.backendFarmShift.exception.ConflictException;
import com.farmshift.backendFarmShift.exception.ResourceNotFoundException;
import com.farmshift.backendFarmShift.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.util.List;

@Service @RequiredArgsConstructor @Transactional(readOnly = true)
public class InventoryItemService {
    private final InventoryItemRepository repository;
    private final WarehouseCategoryRepository warehouses;
    private final ProductCategoryRepository products;
    private final BrandRepository brands;
    private final MeasurementUnitRepository units;
    private final FarmingProgramStepRepository programSteps;
    private final DailyTaskLogRepository taskLogs;
    private final PurchaseInvoiceItemRepository purchaseItems;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.farmshift.backendFarmShift.service.ai.DynamicVietnameseSpeechNormalizer speechNormalizer;
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private WorkAssignmentService workAssignmentService;
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private BarnRepository barnRepository;
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private AccountRepository accountRepository;
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private DiseaseTreatmentLogRepository diseaseTreatmentLogs;
    /** warehouseId null: mọi hàng hóa của mọi kho (dùng khi gắn hàng hóa vào chương trình nuôi). */
    public List<InventoryItemResponse> list(Long warehouseId) { return list(warehouseId, false, true); }
    public List<InventoryItemResponse> list(Long warehouseId, boolean includeReceipts) { return list(warehouseId, includeReceipts, true); }
    public List<InventoryItemResponse> list(Long warehouseId, boolean includeReceipts, boolean canSeeFinance) {
        return list(warehouseId, null, includeReceipts, canSeeFinance, null);
    }
    public List<InventoryItemResponse> list(Long warehouseId, boolean includeReceipts, boolean canSeeFinance, String workerEmail) {
        return list(warehouseId, null, includeReceipts, canSeeFinance, workerEmail);
    }
    public List<InventoryItemResponse> list(Long warehouseId, Long areaId, boolean includeReceipts, boolean canSeeFinance, String workerEmail) {
        boolean effectiveIncludeReceipts = canSeeFinance && includeReceipts;
        List<InventoryItem> items;
        if (warehouseId != null) {
            if (!warehouses.existsById(warehouseId)) throw new ResourceNotFoundException("Kho không tồn tại.");
            if (areaId != null) {
                boolean belongs = warehouses.findAllByArea_Id(areaId).stream().anyMatch(w -> w.getId().equals(warehouseId));
                items = belongs ? repository.findByWarehouse_Id(warehouseId, Sort.by("createdAt", "id")) : List.of();
            } else {
                items = repository.findByWarehouse_Id(warehouseId, Sort.by("createdAt", "id"));
            }
        } else if (areaId != null) {
            java.util.Set<Long> areaWarehouseIds = warehouses.findAllByArea_Id(areaId).stream()
                    .map(com.farmshift.backendFarmShift.entity.WarehouseCategory::getId)
                    .collect(java.util.stream.Collectors.toSet());
            items = areaWarehouseIds.isEmpty()
                    ? List.of()
                    : repository.findByWarehouse_IdIn(areaWarehouseIds, Sort.by("warehouse.name", "product.name"));
        } else {
            items = repository.findAllWithDetailsBy(Sort.by("warehouse.name", "product.name"));
        }
        var receipts = new java.util.HashMap<Long, com.farmshift.backendFarmShift.dto.response.InventoryReceiptResponse>();
        if (effectiveIncludeReceipts) {
            var ids = items.stream().map(InventoryItem::getPurchaseInvoiceItemId).filter(java.util.Objects::nonNull).distinct().toList();
            if (!ids.isEmpty()) for (var row : purchaseItems.findByIdIn(ids)) {
                var invoice = row.getInvoice();
                Long unitPrice = canSeeFinance ? row.getUnitPrice() : null;
                receipts.put(row.getId(), new com.farmshift.backendFarmShift.dto.response.InventoryReceiptResponse(
                        invoice.getId(), invoice.getCode(), invoice.getImportedDate(), row.getQuantity(), row.getUnit(), unitPrice));
            }
        }
        return items.stream().map(item -> response(item, receipts.get(item.getPurchaseInvoiceItemId()), canSeeFinance)).toList();
    }
    public InventoryItemResponse get(Long id) { return get(id, true); }
    public InventoryItemResponse get(Long id, boolean canSeeFinance) { return get(id, canSeeFinance, null); }
    public InventoryItemResponse get(Long id, boolean canSeeFinance, String workerEmail) {
        return response(find(id), null, canSeeFinance);
    }

    public java.util.Set<Long> allowedAreaIdsForWorker(String workerEmail) {
        if (workerEmail == null || workerEmail.isBlank() || workAssignmentService == null || barnRepository == null) {
            return java.util.Set.of();
        }
        java.util.Set<Long> barnIds = workAssignmentService.barnIdsOf(workerEmail);
        if (barnIds.isEmpty()) {
            return java.util.Set.of();
        }
        return barnRepository.findAllById(barnIds).stream()
                .map(com.farmshift.backendFarmShift.entity.Barn::getArea)
                .filter(java.util.Objects::nonNull)
                .map(com.farmshift.backendFarmShift.entity.FarmArea::getId)
                .filter(java.util.Objects::nonNull)
                .collect(java.util.stream.Collectors.toSet());
    }

    public java.util.Set<Long> allowedWarehouseIdsForWorker(String workerEmail) {
        if (workerEmail == null || workerEmail.isBlank()) {
            return java.util.Set.of();
        }
        java.util.Set<Long> allowed = new java.util.HashSet<>();
        java.util.Set<Long> areaIds = allowedAreaIdsForWorker(workerEmail);
        if (!areaIds.isEmpty()) {
            warehouses.findAllByAreaIdIn(areaIds).forEach(w -> allowed.add(w.getId()));
        }
        if (accountRepository != null) {
            String normalizedEmail = workerEmail.strip().toLowerCase(java.util.Locale.ROOT);
            accountRepository.findByEmail(normalizedEmail)
                    .filter(a -> !Boolean.FALSE.equals(a.getIsActive()))
                    .map(com.farmshift.backendFarmShift.entity.Account::getId)
                    .ifPresent(workerId -> warehouses.findDistinctByWorkers_IdIn(List.of(workerId))
                            .forEach(w -> allowed.add(w.getId())));
        }
        return allowed;
    }
    @Transactional public InventoryItemResponse create(InventoryItemRequest request) {
        var item = new InventoryItem(); item.setStock(BigDecimal.ZERO); return save(item, request);
    }
    @Transactional public InventoryItemResponse update(Long id, InventoryItemRequest request) { return save(find(id), request); }
    @Transactional public void delete(Long id) {
        var item = find(id);
        if (item.getStock().signum() != 0) throw new ConflictException("Không thể xóa hàng hóa đang còn tồn kho.", "INVENTORY_IN_USE", null);
        if (programSteps.existsByInventoryItemId(id) || taskLogs.existsByInventoryItemId(id) || taskLogs.existsByStockAllocations_Item_Id(id)
                || (diseaseTreatmentLogs != null && (diseaseTreatmentLogs.existsByInventoryItemId(id)
                || diseaseTreatmentLogs.existsByStockAllocations_Item_Id(id)))) {
            throw new ConflictException("Hàng hóa đang được dùng trong chương trình nuôi, phiếu việc hoặc sổ bệnh án nên không thể xóa.", "INVENTORY_IN_USE", null);
        }
        repository.delete(item);
    }
    private InventoryItem find(Long id) { return repository.findWithDetailsById(id).orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy hàng hóa.")); }
    private InventoryItemResponse save(InventoryItem item, InventoryItemRequest request) {
        var warehouse = warehouses.findById(request.warehouseId()).orElseThrow(() -> new ResourceNotFoundException("Kho đã chọn không tồn tại."));
        String name = java.text.Normalizer.normalize(request.name().strip(), java.text.Normalizer.Form.NFC);
        String key = name.toLowerCase(java.util.Locale.ROOT);
        // Share the catalog product across warehouses; inventory is unique per warehouse/product.
        var product = products.findByNameKey(key).orElseGet(() -> {
            var created = new com.farmshift.backendFarmShift.entity.ProductCategory();
            created.setName(name); created.setNameKey(key); created.setWarehouse(warehouse);
            return products.saveAndFlush(created);
        });
        var unit = units.findById(request.unitId()).orElseThrow(() -> new ResourceNotFoundException("Đơn vị tính đã chọn không tồn tại."));
        if (item.getId() != null && item.getStock().signum() != 0 && (item.getUnit() == null || !item.getUnit().getId().equals(unit.getId()))) {
            throw new ConflictException("Không thể đổi đơn vị của hàng hóa đang còn tồn kho.", "INVENTORY_IN_USE", "unitId");
        }
        boolean identityChanged = item.getId() == null
                || !item.getWarehouse().getId().equals(warehouse.getId())
                || !item.getProduct().getId().equals(product.getId());
        if (identityChanged && repository.existsByWarehouse_IdAndProduct_IdAndIdNot(warehouse.getId(), product.getId(), item.getId() == null ? -1L : item.getId())) throw duplicate();
        if (item.getId() != null && item.getStock().signum() != 0 && (!item.getWarehouse().getId().equals(warehouse.getId()) || !item.getProduct().getId().equals(product.getId()))) {
            throw new ConflictException("Không thể đổi kho hoặc tên hàng hóa đang còn tồn kho.", "INVENTORY_IN_USE", null);
        }
        String image = request.imageUrl() == null ? null : request.imageUrl().strip();
        if (image != null && !image.isEmpty() && !(image.startsWith("/img/") || image.startsWith("https://") || image.startsWith("http://"))) throw new BadRequestException("Đường dẫn ảnh không hợp lệ.");
        item.setWarehouse(warehouse); item.setProduct(product); item.setPrice(request.price()); item.setImageUrl(image == null || image.isEmpty() ? null : image);
        item.setUnit(unit);
        item.setBrand(request.brandId() == null ? null : brands.findById(request.brandId()).orElseThrow(() -> new ResourceNotFoundException("Nhãn hiệu đã chọn không tồn tại.")));
        try {
            InventoryItemResponse saved = response(repository.saveAndFlush(item));
            if (speechNormalizer != null) speechNormalizer.evictLexiconCache();
            return saved;
        }
        catch (DataIntegrityViolationException exception) { throw duplicate(); }
    }
    private ConflictException duplicate() { return new ConflictException("Hàng hóa này đã có trong kho.", "INVENTORY_DUPLICATE", "productId"); }
    private InventoryItemResponse response(InventoryItem item) { return response(item, null, true); }
    private InventoryItemResponse response(InventoryItem item, com.farmshift.backendFarmShift.dto.response.InventoryReceiptResponse receipt, boolean canSeeFinance) {
        BigDecimal price = canSeeFinance ? item.getPrice() : null;
        return new InventoryItemResponse(item.getId(), item.getWarehouse().getId(), item.getWarehouse().getName(), item.getProduct().getId(), item.getProduct().getName(),
                item.getImageUrl(), price, item.getStock(), item.getBrand() == null ? null : item.getBrand().getId(), item.getBrand() == null ? "" : item.getBrand().getName(), item.getCreatedAt(),
                item.getUnit() == null ? null : item.getUnit().getId(), item.getUnit() == null ? "" : item.getUnit().getName(), item.getUnit() == null ? "" : item.getUnit().getCode(),
                item.getUnit() == null ? null : item.getUnit().getContentQuantity(), item.getUnit() == null ? null : item.getUnit().getContentUnit(),
                item.getProduct().getProductType(), receipt);
    }
}
