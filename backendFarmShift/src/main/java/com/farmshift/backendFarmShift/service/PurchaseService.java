package com.farmshift.backendFarmShift.service;

import com.farmshift.backendFarmShift.dto.request.PurchaseInvoiceItemRequest;
import com.farmshift.backendFarmShift.dto.request.PurchaseInvoiceRequest;
import com.farmshift.backendFarmShift.dto.request.PurchasePaymentRequest;
import com.farmshift.backendFarmShift.dto.response.PurchaseInvoiceItemResponse;
import com.farmshift.backendFarmShift.dto.response.PurchaseInvoiceResponse;
import com.farmshift.backendFarmShift.entity.*;
import com.farmshift.backendFarmShift.exception.BadRequestException;
import com.farmshift.backendFarmShift.exception.ResourceNotFoundException;
import com.farmshift.backendFarmShift.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.time.LocalDate;
import java.util.*;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PurchaseService {
    private final PurchaseInvoiceRepository invoiceRepository;
    private final SupplierRepository supplierRepository;
    private final ProductCategoryRepository productCategoryRepository;
    private final InventoryItemRepository inventoryRepository;
    private final PurchaseTagRepository tagRepository;
    private final ProductTypeRepository productTypeRepository;
    private final WarehouseCategoryRepository warehouseCategoryRepository;
    private final MeasurementUnitRepository measurementUnitRepository;

    public List<PurchaseInvoiceResponse> list(String search, String paymentStatus) {
        return invoiceRepository.searchInvoices(search, paymentStatus).stream().map(this::toResponse).toList();
    }

    public PurchaseInvoiceResponse get(Long id) {
        return toResponse(find(id));
    }

    @Transactional
    public PurchaseInvoiceResponse create(PurchaseInvoiceRequest request) {
        Supplier supplier = resolveSupplier(request);

        PurchaseInvoice invoice = new PurchaseInvoice();
        invoice.setCode(generateNextCode());
        invoice.setSupplier(supplier);
        invoice.setInvoiceDate(request.date());
        invoice.setDiscountAmount(request.discountAmount() != null ? request.discountAmount() : 0L);
        invoice.setOtherCost(request.otherCost() != null ? request.otherCost() : 0L);
        invoice.setReferenceCode(request.referenceCode() != null ? request.referenceCode().strip() : null);
        invoice.setNote(request.note() != null ? request.note().strip() : "");
        invoice.setAttachmentUrl(request.attachmentUrl());

        if (request.tagIds() != null && !request.tagIds().isEmpty()) {
            invoice.setTags(new HashSet<>(tagRepository.findAllById(request.tagIds())));
        }

        long itemsTotal = 0L;
        for (PurchaseInvoiceItemRequest itemReq : request.items()) {
            ProductCategory category = null;
            if (itemReq.productCategoryId() != null) {
                category = productCategoryRepository.findById(itemReq.productCategoryId()).orElse(null);
            }
            long lineAmount = Math.round(itemReq.qty() * itemReq.price());
            itemsTotal += lineAmount;

            PurchaseInvoiceItem item = new PurchaseInvoiceItem(
                    invoice,
                    category,
                    itemReq.name().strip(),
                    itemReq.qty(),
                    itemReq.unit().strip(),
                    itemReq.price(),
                    itemReq.vatRate(),
                    lineAmount
            );
            invoice.addItem(item);
        }

        long totalAmount = Math.max(0L, itemsTotal - invoice.getDiscountAmount() + invoice.getOtherCost());
        invoice.setTotalAmount(totalAmount);

        long paid = request.paidAmount() != null ? request.paidAmount() : 0L;
        String paymentStatus = request.paymentStatus();

        if ("Thanh toán hoàn tất".equalsIgnoreCase(paymentStatus)) {
            paid = totalAmount;
            paymentStatus = "Thanh toán hoàn tất";
        } else if ("Trả sau".equalsIgnoreCase(paymentStatus)) {
            paid = 0L;
            paymentStatus = "Trả sau";
        } else if ("Thanh toán một phần".equalsIgnoreCase(paymentStatus) || paymentStatus == null || paymentStatus.isBlank()) {
            if (paid >= totalAmount && totalAmount > 0) {
                paymentStatus = "Thanh toán hoàn tất";
            } else if (paid > 0) {
                paymentStatus = "Thanh toán một phần";
            } else {
                paymentStatus = "Trả sau";
            }
        }
        invoice.setPaidAmount(paid);
        invoice.setPaymentStatus(paymentStatus);

        String stockStatus = request.stockStatus();
        if (stockStatus == null || stockStatus.isBlank()) {
            stockStatus = "Đã nhập kho";
        }
        invoice.setStockStatus(stockStatus);

        PurchaseInvoice saved = invoiceRepository.saveAndFlush(invoice);

        // If stock is marked as IMPORTED on creation, update inventory immediately
        if ("Đã nhập kho".equalsIgnoreCase(stockStatus)) {
            increaseStockForInvoice(saved);
        }

        return toResponse(saved);
    }

    @Transactional
    public PurchaseInvoiceResponse importStock(Long id) {
        PurchaseInvoice invoice = find(id);
        if ("Đã nhập kho".equalsIgnoreCase(invoice.getStockStatus())) {
            return toResponse(invoice);
        }
        if ("Đã hủy".equalsIgnoreCase(invoice.getStockStatus())) {
            throw new BadRequestException("Không thể nhập kho cho hóa đơn đã bị hủy.");
        }

        invoice.setStockStatus("Đã nhập kho");
        increaseStockForInvoice(invoice);

        return toResponse(invoiceRepository.saveAndFlush(invoice));
    }

    @Transactional
    public PurchaseInvoiceResponse pay(Long id, PurchasePaymentRequest request) {
        PurchaseInvoice invoice = find(id);
        if ("Đã hủy".equalsIgnoreCase(invoice.getStockStatus())) {
            throw new BadRequestException("Không thể thanh toán cho hóa đơn đã bị hủy.");
        }

        long newPaid = invoice.getPaidAmount() + request.amount();
        invoice.setPaidAmount(newPaid);

        if (newPaid >= invoice.getTotalAmount()) {
            invoice.setPaymentStatus("Thanh toán hoàn tất");
        } else {
            invoice.setPaymentStatus("Thanh toán một phần");
        }

        if (request.note() != null && !request.note().isBlank()) {
            String updatedNote = invoice.getNote() == null || invoice.getNote().isBlank()
                    ? request.note().strip()
                    : invoice.getNote() + " | " + request.note().strip();
            invoice.setNote(updatedNote);
        }

        return toResponse(invoiceRepository.saveAndFlush(invoice));
    }

    @Transactional
    public void cancel(Long id) {
        PurchaseInvoice invoice = find(id);

        // System rule: finalized/stocked or paid records cannot be cancelled/deleted
        if ("Đã nhập kho".equalsIgnoreCase(invoice.getStockStatus()) || invoice.getPaidAmount() > 0) {
            throw new BadRequestException(
                    "Bản ghi đã quyết toán không thể bị xóa. Vui lòng sử dụng điều chỉnh hoặc đính chính được cấp quyền.",
                    "MSG39"
            );
        }

        invoice.setStockStatus("Đã hủy");
        invoiceRepository.saveAndFlush(invoice);
    }

    private void increaseStockForInvoice(PurchaseInvoice invoice) {
        for (PurchaseInvoiceItem item : invoice.getItems()) {
            String name = Normalizer.normalize(item.getProductName().strip(), Normalizer.Form.NFC);
            String nameKey = name.toLowerCase(Locale.ROOT);

            ProductCategory product = item.getProductCategory();
            if (product == null) {
                product = productCategoryRepository.findByNameKey(nameKey).orElse(null);
            }

            WarehouseCategory warehouse = null;
            if (product != null && product.getWarehouse() != null) {
                warehouse = product.getWarehouse();
            } else {
                warehouse = warehouseCategoryRepository.findAll().stream().findFirst().orElseGet(() -> {
                    WarehouseCategory defaultWh = new WarehouseCategory();
                    defaultWh.setName("Kho tổng");
                    defaultWh.setNameKey("kho tổng");
                    return warehouseCategoryRepository.saveAndFlush(defaultWh);
                });
            }

            if (product == null) {
                product = new ProductCategory();
                product.setName(name);
                product.setNameKey(nameKey);
                product.setWarehouse(warehouse);
                product = productCategoryRepository.saveAndFlush(product);
            }

            MeasurementUnit unit = null;
            if (item.getUnit() != null && !item.getUnit().isBlank()) {
                String unitName = Normalizer.normalize(item.getUnit().strip(), Normalizer.Form.NFC);
                String unitKey = unitName.toLowerCase(Locale.ROOT);
                unit = measurementUnitRepository.findByNameKey(unitKey)
                        .or(() -> measurementUnitRepository.findByCodeKey(unitKey))
                        .orElseGet(() -> {
                            MeasurementUnit mu = new MeasurementUnit();
                            String code = unitName.length() > 20 ? unitName.substring(0, 20).toUpperCase(Locale.ROOT) : unitName.toUpperCase(Locale.ROOT);
                            String codeKey = code.toLowerCase(Locale.ROOT);
                            if (measurementUnitRepository.existsByCodeKeyAndIdNot(codeKey, -1L)) {
                                code = code + "_" + (System.currentTimeMillis() % 1000);
                                codeKey = code.toLowerCase(Locale.ROOT);
                            }
                            mu.setCode(code);
                            mu.setCodeKey(codeKey);
                            mu.setName(unitName);
                            mu.setNameKey(unitKey);
                            return measurementUnitRepository.saveAndFlush(mu);
                        });
            }

            InventoryItem inventoryItem = inventoryRepository.findByWarehouse_IdAndProduct_Id(warehouse.getId(), product.getId()).orElse(null);
            BigDecimal quantityToAdd = BigDecimal.valueOf(item.getQuantity() != null ? item.getQuantity() : 0.0);
            BigDecimal price = BigDecimal.valueOf(item.getUnitPrice() != null ? item.getUnitPrice() : 0L);

            if (inventoryItem == null) {
                inventoryItem = new InventoryItem();
                inventoryItem.setWarehouse(warehouse);
                inventoryItem.setProduct(product);
                inventoryItem.setUnit(unit);
                inventoryItem.setStock(quantityToAdd);
                inventoryItem.setPrice(price);
            } else {
                BigDecimal currentStock = inventoryItem.getStock() != null ? inventoryItem.getStock() : BigDecimal.ZERO;
                inventoryItem.setStock(currentStock.add(quantityToAdd));
                if (price.compareTo(BigDecimal.ZERO) > 0) {
                    inventoryItem.setPrice(price);
                }
                if (inventoryItem.getUnit() == null && unit != null) {
                    inventoryItem.setUnit(unit);
                }
            }

            inventoryRepository.save(inventoryItem);
        }
    }

    private Supplier resolveSupplier(PurchaseInvoiceRequest request) {
        if (request.supplierId() != null) {
            return supplierRepository.findById(request.supplierId())
                    .orElseThrow(() -> new ResourceNotFoundException("Nhà cung cấp đã chọn không tồn tại."));
        }
        if (request.supplierName() != null && !request.supplierName().isBlank()) {
            String name = Normalizer.normalize(request.supplierName().strip(), Normalizer.Form.NFC);
            String key = name.toLowerCase(Locale.ROOT);
            return supplierRepository.findByNameKey(key).orElseGet(() -> {
                Supplier newSupplier = new Supplier();
                newSupplier.setName(name);
                newSupplier.setNameKey(key);
                newSupplier.setRepresentative("Đại diện NCC");
                newSupplier.setPhone("0988111222");

                ProductType defaultType = productTypeRepository.findAll().stream().findFirst().orElseGet(() -> {
                    ProductType created = new ProductType();
                    created.setName("Vật tư chung");
                    created.setNameKey("vật tư chung");
                    return productTypeRepository.saveAndFlush(created);
                });
                newSupplier.setProductType(defaultType);
                return supplierRepository.saveAndFlush(newSupplier);
            });
        }
        throw new BadRequestException("Vui lòng chọn hoặc nhập tên nhà cung cấp.");
    }

    private String generateNextCode() {
        long count = invoiceRepository.count();
        String code = String.format(Locale.ROOT, "NH%06d", count);
        while (invoiceRepository.findByCode(code).isPresent()) {
            count++;
            code = String.format(Locale.ROOT, "NH%06d", count);
        }
        return code;
    }

    private PurchaseInvoice find(Long id) {
        return invoiceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy hóa đơn nhập hàng."));
    }

    private PurchaseInvoiceResponse toResponse(PurchaseInvoice invoice) {
        List<PurchaseInvoiceItemResponse> items = invoice.getItems().stream().map(it ->
                new PurchaseInvoiceItemResponse(
                        it.getId(),
                        it.getProductCategory() != null ? it.getProductCategory().getId() : null,
                        it.getProductName(),
                        it.getQuantity(),
                        it.getUnit(),
                        it.getUnitPrice(),
                        it.getVatRate(),
                        it.getAmount()
                )
        ).toList();

        List<Long> tagIds = invoice.getTags() == null ? List.of() : invoice.getTags().stream().map(PurchaseTag::getId).toList();
        List<String> tagNames = invoice.getTags() == null ? List.of() : invoice.getTags().stream().map(PurchaseTag::getName).toList();
        long debt = Math.max(0L, invoice.getTotalAmount() - invoice.getPaidAmount());

        return new PurchaseInvoiceResponse(
                invoice.getId(),
                invoice.getCode(),
                invoice.getInvoiceDate(),
                invoice.getSupplier().getId(),
                invoice.getSupplier().getName(),
                invoice.getSupplier().getPhone(),
                invoice.getTotalAmount(),
                invoice.getPaidAmount(),
                debt,
                invoice.getPaymentStatus(),
                invoice.getStockStatus(),
                invoice.getDiscountAmount(),
                invoice.getOtherCost(),
                invoice.getReferenceCode(),
                invoice.getNote(),
                invoice.getAttachmentUrl(),
                tagIds,
                tagNames,
                items,
                invoice.getCreatedAt()
        );
    }
}
