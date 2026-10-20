package com.farmshift.backendFarmShift.dto.response;
import java.time.LocalDateTime;
public record TransferCategoryResponse(Long id, String type, String name, String description, long slipCount, LocalDateTime createdAt) {}
