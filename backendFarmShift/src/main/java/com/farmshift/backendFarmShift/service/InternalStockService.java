package com.farmshift.backendFarmShift.service;

import com.farmshift.backendFarmShift.dto.request.InternalStockVoucherItemRequest;
import com.farmshift.backendFarmShift.dto.request.InternalStockVoucherRequest;
import com.farmshift.backendFarmShift.dto.response.InternalStockVoucherItemResponse;
import com.farmshift.backendFarmShift.dto.response.InternalStockVoucherPageResponse;
import com.farmshift.backendFarmShift.dto.response.InternalStockVoucherResponse;
import com.farmshift.backendFarmShift.entity.*;
import com.farmshift.backendFarmShift.exception.BadRequestException;
import com.farmshift.backendFarmShift.exception.ResourceNotFoundException;
import com.farmshift.backendFarmShift.repository.*;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class InternalStockService {
    private final InternalStockVoucherRepository voucherRepository;
    private final InternalStockCategoryRepository categoryRepository;
    private final WarehouseCategoryRepository warehouseRepository;
    private final ProductCategoryRepository productCategoryRepository;
    private final MeasurementUnitRepository measurementUnitRepository;
    private final InventoryItemRepository inventoryItemRepository;
    private final FarmingCycleRepository cycleRepository;
    private final CycleExpenseRepository cycleExpenseRepository;
    private final InternalStockCodeGenerator codeGenerator;

    public InternalStockVoucherPageResponse list(
            String movementType,
            Long categoryId,
            Long warehouseId,
            String status,
            LocalDate startDate,
            LocalDate endDate,
            String q,
            Pageable pageable,
            boolean canSeeFinance
    ) {
        Specification<InternalStockVoucher> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (movementType != null && !movementType.isBlank()) {
                predicates.add(cb.equal(root.get("movementType"), movementType.trim()));
            }
            if (categoryId != null) {
                predicates.add(cb.equal(root.get("category").get("id"), categoryId));
            }
            if (warehouseId != null) {
                predicates.add(cb.or(
                        cb.equal(root.get("sourceWarehouse").get("id"), warehouseId),
                        cb.equal(root.get("targetWarehouse").get("id"), warehouseId)
                ));
            }
            if (status != null && !status.isBlank()) {
                predicates.add(cb.equal(root.get("status"), status.trim()));
            }
            if (startDate != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("movementDate"), startDate));
            }
            if (endDate != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("movementDate"), endDate));
            }
            if (q != null && !q.isBlank()) {
                String search = "%" + q.trim().toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("code")), search),
                        cb.like(cb.lower(root.get("note")), search)
                ));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<InternalStockVoucher> page = voucherRepository.findAll(spec, pageable);
        List<InternalStockVoucherResponse> dtoList = page.getContent().stream()
                .map(v -> toResponse(v, canSeeFinance))
                .toList();

        return new InternalStockVoucherPageResponse(
                dtoList,
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages()
        );
    }

    public InternalStockVoucherResponse get(Long id, boolean canSeeFinance) {
        InternalStockVoucher voucher = voucherRepository.findWithDetailsById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phiếu xuất nhập nội bộ."));
        return toResponse(voucher, canSeeFinance);
    }

    @Transactional
    public InternalStockVoucherResponse create(InternalStockVoucherRequest request, String createdBy) {
        InternalStockCategory category = categoryRepository.findById(request.categoryId())
                .orElseThrow(() -> new ResourceNotFoundException("Danh mục phiếu không tồn tại."));

        if (!category.getMovementType().equalsIgnoreCase(request.movementType())) {
            throw new BadRequestException("Loại phiếu không khớp với danh mục đã chọn.");
        }

        String type = request.movementType().toUpperCase(Locale.ROOT);
        InternalStockVoucher voucher = new InternalStockVoucher();
        voucher.setCode(codeGenerator.nextCode());
        voucher.setMovementType(type);
        voucher.setCategory(category);
        voucher.setMovementDate(request.movementDate());
        voucher.setNote(request.note() == null ? "" : request.note().strip());
        voucher.setAttachmentUrl(request.attachmentUrl());
        voucher.setCreatedBy(createdBy);
        voucher.setStatus("COMPLETED");

        WarehouseCategory sourceWarehouse = null;
        WarehouseCategory targetWarehouse = null;

        if ("EXPORT".equals(type) || "TRANSFER".equals(type)) {
            if (request.sourceWarehouseId() == null) {
                throw new BadRequestException("Kho xuất không được để trống đối với phiếu xuất kho hoặc chuyển kho.");
            }
            sourceWarehouse = warehouseRepository.findById(request.sourceWarehouseId())
                    .orElseThrow(() -> new ResourceNotFoundException("Kho xuất không tồn tại."));
            voucher.setSourceWarehouse(sourceWarehouse);
        }

        if ("IMPORT".equals(type) || "TRANSFER".equals(type)) {
            if (request.targetWarehouseId() == null) {
                throw new BadRequestException("Kho nhập không được để trống đối với phiếu nhập kho hoặc chuyển kho.");
            }
            targetWarehouse = warehouseRepository.findById(request.targetWarehouseId())
                    .orElseThrow(() -> new ResourceNotFoundException("Kho nhập không tồn tại."));
            voucher.setTargetWarehouse(targetWarehouse);
        }

        if ("TRANSFER".equals(type)) {
            if (sourceWarehouse.getId().equals(targetWarehouse.getId())) {
                throw new BadRequestException("Kho xuất và kho nhập phải khác nhau.");
            }
        }

        BigDecimal totalAmount = BigDecimal.ZERO;
        List<InternalStockVoucherItem> items = new ArrayList<>();

        for (InternalStockVoucherItemRequest itemReq : request.items()) {
            Long pId = itemReq.productId();
            ProductCategory product = null;
            if (pId != null) {
                product = productCategoryRepository.findById(pId).orElse(null);
            }
            if (product == null && itemReq.inventoryItemId() != null) {
                InventoryItem inv = inventoryItemRepository.findById(itemReq.inventoryItemId()).orElse(null);
                if (inv != null) {
                    product = inv.getProduct();
                }
            }
            if (product == null) {
                throw new BadRequestException("Hàng hóa không hợp lệ hoặc không tồn tại.");
            }

            MeasurementUnit unit = null;
            if (itemReq.unitId() != null) {
                unit = measurementUnitRepository.findById(itemReq.unitId()).orElse(null);
            }

            BigDecimal qty = itemReq.quantity().setScale(3, RoundingMode.HALF_UP);
            BigDecimal unitPrice = itemReq.unitPrice() != null ? itemReq.unitPrice().setScale(2, RoundingMode.HALF_UP) : BigDecimal.ZERO;
            InternalStockVoucherItem item = new InternalStockVoucherItem();
            item.setVoucher(voucher);
            item.setProduct(product);
            item.setUnit(unit);
            item.setQuantity(qty);
            item.setNote(itemReq.note() == null ? "" : itemReq.note().strip());

            if ("IMPORT".equals(type)) {
                // Tăng tồn kho hoặc tạo mới ở kho nhập
                Optional<InventoryItem> existingOpt = compatibleLot(targetWarehouse.getId(), product.getId(), unitPrice, unit, null);
                InventoryItem targetItem;
                if (existingOpt.isPresent()) {
                    targetItem = existingOpt.get();
                    inventoryItemRepository.returnStock(targetItem.getId(), qty);
                    targetItem.setStock((targetItem.getStock() == null ? BigDecimal.ZERO : targetItem.getStock()).add(qty));
                    if (unitPrice.compareTo(BigDecimal.ZERO) > 0) {
                        targetItem.setPrice(unitPrice);
                        inventoryItemRepository.save(targetItem);
                    }
                } else {
                    targetItem = new InventoryItem();
                    targetItem.setProduct(product);
                    targetItem.setWarehouse(targetWarehouse);
                    targetItem.setUnit(unit);
                    targetItem.setPrice(unitPrice);
                    targetItem.setStock(qty);
                    targetItem = inventoryItemRepository.save(targetItem);
                }
                item.setTargetInventoryItem(targetItem);
                item.setUnitPrice(unitPrice);
                BigDecimal lineAmount = qty.multiply(unitPrice).setScale(2, RoundingMode.HALF_UP);
                item.setAmount(lineAmount);
                totalAmount = totalAmount.add(lineAmount);

            } else if ("EXPORT".equals(type)) {
                // Trừ tồn kho nguyên tử ở kho xuất
                InventoryItem sourceItem = sourceLot(itemReq.inventoryItemId(), sourceWarehouse.getId(), product.getId());

                int updated = inventoryItemRepository.takeStock(sourceItem.getId(), qty);
                if (updated == 0) {
                    throw new BadRequestException("Tồn kho khả dụng không đủ. Giao dịch này sẽ làm cho số dư tồn kho bị âm. [MSG27]");
                }
                sourceItem.setStock(sourceItem.getStock().subtract(qty));

                item.setSourceInventoryItem(sourceItem);
                BigDecimal effectivePrice = unitPrice.compareTo(BigDecimal.ZERO) > 0 ? unitPrice : (sourceItem.getPrice() != null ? sourceItem.getPrice() : BigDecimal.ZERO);
                item.setUnitPrice(effectivePrice);
                BigDecimal lineAmount = qty.multiply(effectivePrice).setScale(2, RoundingMode.HALF_UP);
                item.setAmount(lineAmount);
                totalAmount = totalAmount.add(lineAmount);

            } else if ("TRANSFER".equals(type)) {
                // Trừ tồn kho nguyên tử ở kho xuất
                InventoryItem sourceItem = sourceLot(itemReq.inventoryItemId(), sourceWarehouse.getId(), product.getId());

                int updated = inventoryItemRepository.takeStock(sourceItem.getId(), qty);
                if (updated == 0) {
                    throw new BadRequestException("Tồn kho khả dụng không đủ. Giao dịch này sẽ làm cho số dư tồn kho bị âm. [MSG27]");
                }
                sourceItem.setStock(sourceItem.getStock().subtract(qty));
                item.setSourceInventoryItem(sourceItem);

                // Cộng tồn kho hoặc tạo mới ở kho nhận
                Optional<InventoryItem> targetOpt = compatibleLot(targetWarehouse.getId(), product.getId(), sourceItem.getPrice(), sourceItem.getUnit(), sourceItem.getBrand());
                InventoryItem targetItem;
                if (targetOpt.isPresent()) {
                    targetItem = targetOpt.get();
                    inventoryItemRepository.returnStock(targetItem.getId(), qty);
                    targetItem.setStock((targetItem.getStock() == null ? BigDecimal.ZERO : targetItem.getStock()).add(qty));
                } else {
                    targetItem = new InventoryItem();
                    targetItem.setProduct(product);
                    targetItem.setWarehouse(targetWarehouse);
                    targetItem.setBrand(sourceItem.getBrand());
                    targetItem.setUnit(sourceItem.getUnit());
                    targetItem.setPrice(sourceItem.getPrice());
                    targetItem.setImageUrl(sourceItem.getImageUrl());
                    targetItem.setStock(qty);
                    targetItem = inventoryItemRepository.save(targetItem);
                }
                item.setTargetInventoryItem(targetItem);

                BigDecimal effectivePrice = sourceItem.getPrice() != null ? sourceItem.getPrice() : BigDecimal.ZERO;
                item.setUnitPrice(effectivePrice);
                BigDecimal lineAmount = qty.multiply(effectivePrice).setScale(2, RoundingMode.HALF_UP);
                item.setAmount(lineAmount);
                totalAmount = totalAmount.add(lineAmount);
            }

            items.add(item);
        }

        voucher.setTotalAmount(totalAmount);
        voucher.setItems(items);

        // Liên kết chi phí lứa nuôi nếu có
        if ("EXPORT".equals(type) && request.cycleId() != null) {
            FarmingCycle cycle = cycleRepository.findById(request.cycleId())
                    .orElseThrow(() -> new ResourceNotFoundException("Lứa nuôi không tồn tại."));
            voucher.setCycle(cycle);

            if (totalAmount.compareTo(BigDecimal.ZERO) > 0) {
                CycleExpense expense = new CycleExpense();
                expense.setCycle(cycle);
                expense.setExpenseDate(request.movementDate());
                expense.setCategory(ExpenseCategory.OTHER);
                expense.setAmount(totalAmount);
                expense.setNote("Xuất hủy/nội bộ [" + voucher.getCode() + "]: " + voucher.getNote());
                expense.setCreatedBy(createdBy);
                expense = cycleExpenseRepository.save(expense);
                voucher.setExpense(expense);
            }
        }

        voucher = voucherRepository.save(voucher);
        return toResponse(voucher, true);
    }

    @Transactional
    public InternalStockVoucherResponse cancel(Long id, String cancelledBy) {
        InternalStockVoucher voucher = voucherRepository.findWithDetailsById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phiếu xuất nhập nội bộ."));

        if (!"COMPLETED".equalsIgnoreCase(voucher.getStatus())) {
            throw new BadRequestException("Chỉ có thể hủy phiếu đang ở trạng thái Hoàn thành.");
        }

        String type = voucher.getMovementType();

        for (InternalStockVoucherItem item : voucher.getItems()) {
            BigDecimal qty = item.getQuantity();

            if ("IMPORT".equals(type)) {
                // Thu hồi hàng đã nhập: trừ khỏi kho nhập
                InventoryItem targetItem = item.getTargetInventoryItem();
                Long targetItemId = targetItem != null ? targetItem.getId() : null;
                if (targetItemId != null) {
                    int updated = inventoryItemRepository.takeStock(targetItemId, qty);
                    if (updated == 0) {
                        throw new BadRequestException("Tồn kho khả dụng không đủ để hoàn tác nhập kho. [MSG27]");
                    }
                }
            } else if ("EXPORT".equals(type)) {
                // Hoàn lại hàng đã xuất: trả về kho xuất
                InventoryItem sourceItem = item.getSourceInventoryItem();
                Long sourceItemId = sourceItem != null ? sourceItem.getId() : null;
                if (sourceItemId != null) {
                    inventoryItemRepository.returnStock(sourceItemId, qty);
                }
            } else if ("TRANSFER".equals(type)) {
                // Thu hồi hàng đã chuyển: trừ ở kho nhận, hoàn lại kho xuất
                InventoryItem targetItem = item.getTargetInventoryItem();
                InventoryItem sourceItem = item.getSourceInventoryItem();
                Long targetItemId = targetItem != null ? targetItem.getId() : null;
                Long sourceItemId = sourceItem != null ? sourceItem.getId() : null;

                if (targetItemId != null) {
                    int updated = inventoryItemRepository.takeStock(targetItemId, qty);
                    if (updated == 0) {
                        throw new BadRequestException("Tồn kho tại kho nhận không đủ để hoàn tác chuyển kho. [MSG27]");
                    }
                }
                if (sourceItemId != null) {
                    inventoryItemRepository.returnStock(sourceItemId, qty);
                }
            }
        }

        // Xóa chi phí lứa nếu có
        Long expenseIdToDelete = null;
        if (voucher.getExpense() != null) {
            expenseIdToDelete = voucher.getExpense().getId();
            voucher.setExpense(null);
        }

        voucher.setStatus("CANCELLED");
        voucher = voucherRepository.saveAndFlush(voucher);

        if (expenseIdToDelete != null) {
            cycleExpenseRepository.deleteById(expenseIdToDelete);
            cycleExpenseRepository.flush();
        }

        return toResponse(voucher, true);
    }

    private InternalStockVoucherResponse toResponse(InternalStockVoucher v, boolean canSeeFinance) {
        List<InternalStockVoucherItemResponse> itemResponses = v.getItems().stream().map(it -> {
            String unitName = it.getUnit() != null ? it.getUnit().getName() : null;
            return new InternalStockVoucherItemResponse(
                    it.getId(),
                    it.getProduct().getId(),
                    String.format(Locale.ROOT, "HH%06d", it.getProduct().getId()),
                    it.getProduct().getName(),
                    it.getUnit() != null ? it.getUnit().getId() : null,
                    unitName,
                    it.getQuantity(),
                    canSeeFinance ? it.getUnitPrice() : null,
                    canSeeFinance ? it.getAmount() : null,
                    it.getNote()
            );
        }).toList();

        return new InternalStockVoucherResponse(
                v.getId(),
                v.getCode(),
                v.getMovementType(),
                v.getCategory().getId(),
                v.getCategory().getName(),
                v.getSourceWarehouse() != null ? v.getSourceWarehouse().getId() : null,
                v.getSourceWarehouse() != null ? v.getSourceWarehouse().getName() : null,
                v.getTargetWarehouse() != null ? v.getTargetWarehouse().getId() : null,
                v.getTargetWarehouse() != null ? v.getTargetWarehouse().getName() : null,
                v.getCycle() != null ? v.getCycle().getId() : null,
                v.getCycle() != null ? ("Lứa " + v.getCycle().getCycleNumber()) : null,
                v.getExpense() != null ? v.getExpense().getId() : null,
                v.getMovementDate(),
                canSeeFinance ? v.getTotalAmount() : null,
                v.getStatus(),
                v.getNote(),
                v.getAttachmentUrl(),
                v.getCreatedBy(),
                v.getCreatedAt(),
                itemResponses
        );
    }
    private InventoryItem sourceLot(Long inventoryItemId, Long warehouseId, Long productId) {
        InventoryItem lot = inventoryItemId == null
                ? inventoryItemRepository.findByWarehouse_IdAndProduct_Id(warehouseId, productId)
                    .orElseThrow(() -> new BadRequestException("Tồn kho khả dụng không đủ. [MSG27]"))
                : inventoryItemRepository.findById(inventoryItemId)
                    .orElseThrow(() -> new BadRequestException("Dòng tồn kho không tồn tại."));
        if (!lot.getWarehouse().getId().equals(warehouseId) || !lot.getProduct().getId().equals(productId)) {
            throw new BadRequestException("Dòng tồn kho không thuộc kho xuất hoặc hàng hóa đã chọn.");
        }
        return lot;
    }

    private Optional<InventoryItem> compatibleLot(Long warehouseId, Long productId, BigDecimal price,
                                                 MeasurementUnit unit, Brand brand) {
        return inventoryItemRepository.findByWarehouse_IdAndProduct_IdOrderByCreatedAtAscIdAsc(warehouseId, productId)
                .stream().filter(lot -> lot.getPrice().compareTo(price) == 0
                        && java.util.Objects.equals(lot.getUnit() == null ? null : lot.getUnit().getId(), unit == null ? null : unit.getId())
                        && java.util.Objects.equals(lot.getBrand() == null ? null : lot.getBrand().getId(), brand == null ? null : brand.getId()))
                .findFirst();
    }

}
