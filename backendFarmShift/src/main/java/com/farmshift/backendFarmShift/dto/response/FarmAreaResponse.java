package com.farmshift.backendFarmShift.dto.response;

import java.time.LocalDateTime;
import java.util.List;

public record FarmAreaResponse(Long id, String code, String name, List<String> environmentMetrics, List<String> animalMetrics, String description,
                               long barnCount, long activeBarnCount, long animalCount, long totalCapacity,
                               LocalDateTime createdAt, LocalDateTime updatedAt,
                               List<WarehouseRef> warehouses) {
    public record WarehouseRef(Long id, String name, String kind) {}

    public FarmAreaResponse(Long id, String code, String name, List<String> environmentMetrics, List<String> animalMetrics, String description,
                            long barnCount, long activeBarnCount, long animalCount, long totalCapacity,
                            LocalDateTime createdAt, LocalDateTime updatedAt) {
        this(id, code, name, environmentMetrics, animalMetrics, description, barnCount, activeBarnCount, animalCount, totalCapacity, createdAt, updatedAt, List.of());
    }
}
