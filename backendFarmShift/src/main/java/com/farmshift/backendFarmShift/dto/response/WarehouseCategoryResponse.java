package com.farmshift.backendFarmShift.dto.response;

import java.time.LocalDateTime;

/** areaId / areaName / kind: khu sở hữu kho và loại kho (FEED kho cám, MEDICINE kho thuốc); null với kho không thuộc khu. */
public record WarehouseCategoryResponse(Long id, String code, String name, String description,
                                        long itemCount, LocalDateTime createdAt, Long areaId, String areaName, String kind) {
}
