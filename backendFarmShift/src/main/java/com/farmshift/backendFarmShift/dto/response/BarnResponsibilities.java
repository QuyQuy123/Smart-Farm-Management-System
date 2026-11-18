package com.farmshift.backendFarmShift.dto.response;

import java.util.List;

public record BarnResponsibilities(List<WorkBoard.WorkerRef> workers, List<Area> areas) {
    public record Area(Long id, String name, List<WorkBoard.WorkerRef> workers, List<Barn> barns, List<WarehouseRef> warehouses) {
        public Area(Long id, String name, List<WorkBoard.WorkerRef> workers, List<Barn> barns) {
            this(id, name, workers, barns, List.of());
        }
    }
    public record Barn(Long id, String name, boolean inherited, List<WorkBoard.WorkerRef> workers) {}
    public record WarehouseRef(Long id, String name, String kind) {}
}
