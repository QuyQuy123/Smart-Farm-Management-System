package com.farmshift.backendFarmShift.service;

import com.farmshift.backendFarmShift.entity.FarmArea;
import com.farmshift.backendFarmShift.entity.WarehouseCategory;
import com.farmshift.backendFarmShift.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.Locale;

/**
 * Kho theo khu: mỗi khu nuôi có đúng một kho cám và một kho thuốc ("Kho cám Gà Hồ", "Kho thuốc Gà Hồ"), không dùng kho chung.
 * Tạo khu thì tạo kho, đổi tên khu thì đổi tên kho, xóa khu thì xóa kho trống (kho còn hàng giữ lại, bỏ liên kết khu).
 */
@Service
@RequiredArgsConstructor
public class AreaWarehouseService {
    public static final String FEED = "FEED";
    public static final String MEDICINE = "MEDICINE";

    private final WarehouseCategoryRepository warehouses;
    private final FarmAreaRepository areas;
    private final InventoryItemRepository inventory;
    private final ProductCategoryRepository products;
    private final InternalStockVoucherRepository vouchers;

    /** Bổ sung kho cho mọi khu chưa đủ (chạy khi khởi động cho dữ liệu cũ). */
    @Transactional
    public void ensureAll() {
        for (FarmArea area : areas.findAll()) {
            if (warehouses.findAllByArea_Id(area.getId()).isEmpty()) {
                ensure(area);
            }
        }
    }

    @Transactional
    public void ensure(FarmArea area) {
        ensure(area, FEED);
        ensure(area, MEDICINE);
    }

    /** Đổi tên khu: đổi theo tên hai kho của khu, trừ khi tên mới đã thuộc về kho khác hoặc kho đang dùng chung cho nhiều khu. */
    @Transactional
    public void rename(FarmArea area) {
        ensure(area);
        for (WarehouseCategory warehouse : warehouses.findAllByArea_Id(area.getId())) {
            if (warehouse.getAreas() != null && warehouse.getAreas().size() > 1) continue;
            String name = name(area.getName(), warehouse.getKind());
            if (name.equals(warehouse.getName()) || warehouses.existsByNameKeyAndIdNot(key(name), warehouse.getId())) continue;
            warehouse.setName(name);
            warehouse.setNameKey(key(name));
            warehouses.save(warehouse);
        }
    }

    /** Trước khi xóa khu: gỡ liên kết khu. Kho trống và không dùng chung cho khu khác thì xóa, kho đã có hàng/phiếu hoặc dùng chung thì giữ lại. */
    @Transactional
    public void release(FarmArea area) {
        var linkedWarehouses = warehouses.findAllByArea_Id(area.getId());
        if (area.getWarehouses() != null) {
            area.getWarehouses().clear();
            areas.saveAndFlush(area);
        }
        for (WarehouseCategory warehouse : linkedWarehouses) {
            Long id = warehouse.getId();
            boolean sharedWithOthers = warehouse.getAreas().stream().anyMatch(a -> !a.getId().equals(area.getId()))
                    || (warehouse.getArea() != null && !warehouse.getArea().getId().equals(area.getId()));
            if (sharedWithOthers) {
                if (warehouse.getArea() != null && warehouse.getArea().getId().equals(area.getId())) {
                    warehouse.setArea(null);
                    warehouses.save(warehouse);
                }
                continue;
            }
            if (inventory.existsByWarehouse_Id(id) || products.existsByWarehouse_Id(id) || vouchers.existsBySourceWarehouse_IdOrTargetWarehouse_Id(id, id)) {
                warehouse.setArea(null);
                warehouses.save(warehouse);
            } else {
                warehouses.delete(warehouse);
            }
        }
        warehouses.flush();
    }

    /** "Khu Gà Hồ" → "Kho cám Gà Hồ" / "Kho thuốc Gà Hồ". */
    public static String name(String areaName, String kind) {
        String place = areaName.strip().replaceFirst("(?iu)^khu\\s+", "");
        return (MEDICINE.equals(kind) ? "Kho thuốc " : "Kho cám ") + place;
    }

    private void ensure(FarmArea area, String kind) {
        if (warehouses.existsByArea_IdAndKind(area.getId(), kind)) return;
        String name = name(area.getName(), kind);
        WarehouseCategory warehouse = warehouses.findByNameKey(key(name)).orElseGet(WarehouseCategory::new);
        if (warehouse.getId() == null) {
            warehouse.setName(name);
            warehouse.setNameKey(key(name));
            warehouse.setDescription((MEDICINE.equals(kind) ? "Thuốc thú y và vắc-xin cho " : "Cám cho các chuồng ") + area.getName());
        }
        if (warehouse.getArea() == null) {
            warehouse.setArea(area);
        }
        warehouse.setKind(kind);
        warehouse = warehouses.save(warehouse);
        if (area.getWarehouses() == null) {
            area.setWarehouses(new java.util.ArrayList<>());
        }
        if (!area.getWarehouses().contains(warehouse)) {
            area.getWarehouses().add(warehouse);
            areas.save(area);
        }
    }

    private static String key(String name) {
        return name.toLowerCase(Locale.ROOT);
    }
}
