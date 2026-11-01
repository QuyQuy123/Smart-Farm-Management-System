package com.farmshift.backendFarmShift.service;

import com.farmshift.backendFarmShift.dto.response.WarehouseResponsibilities;
import com.farmshift.backendFarmShift.dto.response.WorkBoard;
import com.farmshift.backendFarmShift.entity.Account;
import com.farmshift.backendFarmShift.exception.BadRequestException;
import com.farmshift.backendFarmShift.exception.ResourceNotFoundException;
import com.farmshift.backendFarmShift.repository.AccountRepository;
import com.farmshift.backendFarmShift.repository.WarehouseCategoryRepository;
import com.farmshift.backendFarmShift.security.RoleNames;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class WarehouseResponsibilityService {
    private final WarehouseCategoryRepository warehouses;
    private final AccountRepository accounts;

    public WarehouseResponsibilities settings() {
        return new WarehouseResponsibilities(activeWorkers().stream().map(BarnResponsibilityService::ref).toList(),
                warehouses.findAll(Sort.by("createdAt", "id")).stream()
                        .map(warehouse -> new WarehouseResponsibilities.Warehouse(warehouse.getId(), warehouse.getName(),
                                warehouse.getWorkers().stream().map(BarnResponsibilityService::ref).toList())).toList());
    }

    @Transactional
    public List<WorkBoard.WorkerRef> setWorkers(Long warehouseId, List<Long> ids) {
        var warehouse = warehouses.findById(warehouseId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy kho hàng."));
        Map<Long, Account> available = activeWorkers().stream().collect(Collectors.toMap(Account::getId, worker -> worker));
        List<Account> chosen = new ArrayList<>();
        for (Long id : new LinkedHashSet<>(ids)) {
            if (!available.containsKey(id)) throw new BadRequestException("Chỉ phân công được tài khoản công nhân đang hoạt động.", "WORKER_NOT_AVAILABLE");
            chosen.add(available.get(id));
        }
        warehouse.getWorkers().clear();
        warehouse.getWorkers().addAll(chosen);
        warehouses.saveAndFlush(warehouse);
        return chosen.stream().map(BarnResponsibilityService::ref).toList();
    }

    private List<Account> activeWorkers() {
        return accounts.findAllByRole_NameAndIsActiveTrueOrderByFullNameAsc(RoleNames.FARM_WORKER);
    }
}
