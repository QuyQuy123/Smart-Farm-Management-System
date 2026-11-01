package com.farmshift.backendFarmShift.service;

import com.farmshift.backendFarmShift.entity.*;
import com.farmshift.backendFarmShift.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.data.domain.Sort;
import java.text.Normalizer;
import java.util.*;

/** Match exact catalog names within assigned warehouses; never use fuzzy matching for stock deductions. */
@Service
@RequiredArgsConstructor
public class DailyStockSources {
    private final WarehouseCategoryRepository warehouses;
    private final InventoryItemRepository inventory;
    private final WorkAssignmentService assignments;

    public List<List<InventoryItem>> resolve(FarmingCycle cycle, FarmingProgramStep step, String workerEmail) {
        if (UsageMath.usageUnit(step.getCategory(), step.getUnit()) == null) return List.of();
        var workers = assignments.workersOf(cycle.getBarn().getId()).stream()
                .filter(worker -> workerEmail == null || worker.email().equalsIgnoreCase(workerEmail)).toList();
        var stores = workers.isEmpty() ? List.<WarehouseCategory>of()
                : warehouses.findDistinctByWorkers_IdIn(workers.stream().map(worker -> worker.id()).toList());
        // Preserve explicitly linked legacy programs for owners before warehouse assignments are configured.
        if (stores.isEmpty() && workerEmail == null && workers.isEmpty() && step.getInventoryItem() != null) {
            return UsageMath.compatible(step.getInventoryItem(), UsageMath.usageUnit(step.getCategory(), step.getUnit()))
                    ? List.of(List.of(step.getInventoryItem())) : List.of();
        }
        Set<Long> storeIds = new HashSet<>();
        stores.forEach(store -> storeIds.add(store.getId()));
        if (storeIds.isEmpty()) return List.of();
        String name = normalize(step.getInventoryItem() == null ? step.getName() : step.getInventoryItem().getProduct().getName());
        Map<String, List<InventoryItem>> groups = new LinkedHashMap<>();
        for (InventoryItem item : inventory.findAllWithDetailsBy(Sort.by("createdAt", "id"))) {
            if (!storeIds.contains(item.getWarehouse().getId()) || !normalize(item.getProduct().getName()).equals(name)
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
