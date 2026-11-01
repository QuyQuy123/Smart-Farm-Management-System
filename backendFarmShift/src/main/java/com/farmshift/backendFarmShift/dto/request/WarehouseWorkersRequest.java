package com.farmshift.backendFarmShift.dto.request;

import jakarta.validation.constraints.NotNull;
import java.util.List;

public record WarehouseWorkersRequest(@NotNull List<@NotNull Long> workerIds) {}
