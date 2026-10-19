package com.farmshift.backendFarmShift.dto.response;

import java.time.LocalDateTime;
import java.util.List;

public record FarmAreaResponse(Long id, String code, String name, List<String> environmentMetrics, List<String> animalMetrics, String description,
                               long barnCount, long activeBarnCount, long animalCount, long totalCapacity,
                               LocalDateTime createdAt, LocalDateTime updatedAt) {
}
