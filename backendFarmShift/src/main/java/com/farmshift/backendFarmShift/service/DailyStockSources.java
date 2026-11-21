package com.farmshift.backendFarmShift.service;

import com.farmshift.backendFarmShift.entity.*;
import com.farmshift.backendFarmShift.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.data.domain.Sort;
import java.text.Normalizer;
import java.util.*;

/** Match exact catalog names within the barn area's feed/medicine warehouse; never use fuzzy matching for stock deductions. */
@Service
@RequiredArgsConstructor
public class DailyStockSources {
    private final WarehouseCategoryRepository warehouses;
    private final InventoryItemRepository inventory;
    private final FarmAreaRepository areas;

    public Map<Long, Set<Long>> preloadBarnStoreIds(Collection<FarmingCycle> cycles) {
        Map<Long, Set<Long>> result = new HashMap<>();
        if (cycles == null || cycles.isEmpty()) {
            return result;
        }
        Map<Long, Set<Long>> areaStoreIds = new HashMap<>();
        for (WarehouseCategory warehouse : warehouses.findAllWithAreasForReport()) {
            if (warehouse.getArea() != null && warehouse.getArea().getId() != null) {
                areaStoreIds.computeIfAbsent(warehouse.getArea().getId(), ignored -> new HashSet<>())
                        .add(warehouse.getId());
            }
            if (warehouse.getAreas() != null) {
                for (FarmArea linkedArea : warehouse.getAreas()) {
                    if (linkedArea != null && linkedArea.getId() != null) {
                        areaStoreIds.computeIfAbsent(linkedArea.getId(), ignored -> new HashSet<>())
                                .add(warehouse.getId());
                    }
                }
            }
        }
        // Include same-transaction join rows from L1 cache as well.
        for (Object[] pair : areas.findAreaWarehousePairs()) {
            if (pair != null && pair.length >= 2 && pair[0] instanceof Long areaId && pair[1] instanceof Long warehouseId) {
                areaStoreIds.computeIfAbsent(areaId, ignored -> new HashSet<>()).add(warehouseId);
            }
        }
        for (FarmingCycle cycle : cycles) {
            if (cycle.getBarn() != null && cycle.getBarn().getArea() != null) {
                Long areaId = cycle.getBarn().getArea().getId();
                result.put(cycle.getBarn().getId(), areaStoreIds.getOrDefault(areaId, Set.of()));
            }
        }
        return result;
    }

    public List<List<InventoryItem>> resolve(FarmingCycle cycle, FarmingProgramStep step, String workerEmail) {
        return resolve(cycle, step, workerEmail, null, null);
    }

    public List<List<InventoryItem>> resolve(FarmingCycle cycle, FarmingProgramStep step, String workerEmail,
                                            List<InventoryItem> preloadedItems, Map<Long, Set<Long>> barnStoreIdsCache) {
        if (UsageMath.usageUnit(step.getCategory(), step.getUnit()) == null) return List.of();
        Long barnId = cycle.getBarn().getId();
        Set<Long> storeIds;
        if (barnStoreIdsCache != null && barnStoreIdsCache.containsKey(barnId)) {
            storeIds = barnStoreIdsCache.get(barnId);
        } else {
            var stores = warehouses.findAllByArea_Id(cycle.getBarn().getArea().getId());
            storeIds = new HashSet<>();
            stores.forEach(store -> storeIds.add(store.getId()));
            if (barnStoreIdsCache != null) barnStoreIdsCache.put(barnId, storeIds);
        }
        if (storeIds.isEmpty()) return List.of();
        String kind = step.getCategory() == ProgramStepCategory.FEED ? AreaWarehouseService.FEED : AreaWarehouseService.MEDICINE;
        String name = normalize(step.getInventoryItem() == null ? step.getName() : step.getInventoryItem().getProduct().getName());
        Map<String, List<InventoryItem>> groups = new LinkedHashMap<>();
        List<InventoryItem> items = preloadedItems != null ? preloadedItems : inventory.findAllWithDetailsBy(Sort.by("createdAt", "id"));
        for (InventoryItem item : items) {
            boolean kindMatches = item.getWarehouse().getKind() == null || kind.equalsIgnoreCase(item.getWarehouse().getKind());
            if (!storeIds.contains(item.getWarehouse().getId()) || !kindMatches || !normalize(item.getProduct().getName()).equals(name)
                    || !UsageMath.compatible(item, UsageMath.usageUnit(step.getCategory(), step.getUnit()))) continue;
            String key = item.getWarehouse().getId() + ":" + item.getProduct().getId() + ":" + item.getUnit().getId();
            groups.computeIfAbsent(key, ignored -> new ArrayList<>()).add(item);
        }
        return List.copyOf(groups.values());
    }

    private static String normalize(String value) {
        return Normalizer.normalize(value.strip().replaceAll("\\s+", " "), Normalizer.Form.NFC).toLowerCase(Locale.ROOT);
    }
}
