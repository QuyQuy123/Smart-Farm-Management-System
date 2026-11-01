package com.farmshift.backendFarmShift.dto.response;

import java.util.List;

public record WarehouseResponsibilities(List<WorkBoard.WorkerRef> workers, List<Warehouse> warehouses) {
    public record Warehouse(Long id, String name, List<WorkBoard.WorkerRef> workers) {}
}
