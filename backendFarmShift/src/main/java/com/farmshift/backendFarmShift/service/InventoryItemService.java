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
    /** warehouseId null: mọi hàng hóa của mọi kho (dùng khi gắn hàng hóa vào chương trình nuôi). */
    public List<InventoryItemResponse> list(Long warehouseId) { return list(warehouseId, false); }
    public List<InventoryItemResponse> list(Long warehouseId, boolean includeReceipts) {
        List<InventoryItem> items;
        if (warehouseId == null) items = repository.findAllWithDetailsBy(Sort.by("warehouse.name", "product.name"));
        else {
            if (!warehouses.existsById(warehouseId)) throw new ResourceNotFoundException("Kho không tồn tại.");
            items = repository.findByWarehouse_Id(warehouseId, Sort.by("createdAt", "id"));
        }
        var receipts = new java.util.HashMap<Long, com.farmshift.backendFarmShift.dto.response.InventoryReceiptResponse>();
        if (includeReceipts) {
            var ids = items.stream().map(InventoryItem::getPurchaseInvoiceItemId).filter(java.util.Objects::nonNull).distinct().toList();
            if (!ids.isEmpty()) for (var row : purchaseItems.findByIdIn(ids)) {
                var invoice = row.getInvoice();
                receipts.put(row.getId(), new com.farmshift.backendFarmShift.dto.response.InventoryReceiptResponse(
                        invoice.getId(), invoice.getCode(), invoice.getImportedDate(), row.getQuantity(), row.getUnit(), row.getUnitPrice()));
            }
        }
        return items.stream().map(item -> response(item, receipts.get(item.getPurchaseInvoiceItemId()))).toList();
    }
    public InventoryItemResponse get(Long id) { return response(find(id)); }
    @Transactional public InventoryItemResponse create(InventoryItemRequest request) {
        var item = new InventoryItem(); item.setStock(BigDecimal.ZERO); return save(item, request);
    }
    @Transactional public InventoryItemResponse update(Long id, InventoryItemRequest request) { return save(find(id), request); }
    @Transactional public void delete(Long id) {
        var item = find(id);
        if (item.getStock().signum() != 0) throw new ConflictException("Không thể xóa hàng hóa đang còn tồn kho.", "INVENTORY_IN_USE", null);
        if (programSteps.existsByInventoryItemId(id) || taskLogs.existsByInventoryItemId(id)) {
            throw new ConflictException("Hàng hóa đang được dùng trong chương trình nuôi hoặc phiếu việc nên không thể xóa.", "INVENTORY_IN_USE", null);
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
        try { return response(repository.saveAndFlush(item)); }
        catch (DataIntegrityViolationException exception) { throw duplicate(); }
    }
    private ConflictException duplicate() { return new ConflictException("Hàng hóa này đã có trong kho.", "INVENTORY_DUPLICATE", "productId"); }
    private InventoryItemResponse response(InventoryItem item) { return response(item, null); }
    private InventoryItemResponse response(InventoryItem item, com.farmshift.backendFarmShift.dto.response.InventoryReceiptResponse receipt) {
        return new InventoryItemResponse(item.getId(), item.getWarehouse().getId(), item.getWarehouse().getName(), item.getProduct().getId(), item.getProduct().getName(),
                item.getImageUrl(), item.getPrice(), item.getStock(), item.getBrand() == null ? null : item.getBrand().getId(), item.getBrand() == null ? "" : item.getBrand().getName(), item.getCreatedAt(),
                item.getUnit() == null ? null : item.getUnit().getId(), item.getUnit() == null ? "" : item.getUnit().getName(), item.getUnit() == null ? "" : item.getUnit().getCode(),
                item.getUnit() == null ? null : item.getUnit().getContentQuantity(), item.getUnit() == null ? null : item.getUnit().getContentUnit(),
                item.getProduct().getProductType(), receipt);
    }
}
