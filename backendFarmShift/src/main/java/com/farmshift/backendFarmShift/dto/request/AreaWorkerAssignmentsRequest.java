package com.farmshift.backendFarmShift.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.List;

/** Save the area and all its barns in one transaction. */
public record AreaWorkerAssignmentsRequest(
        @NotNull List<@NotNull Long> workerIds,
        @NotNull Boolean applyToAll,
        @NotNull List<@NotNull @Valid BarnAssignment> barns) {
    public record BarnAssignment(@NotNull Long barnId, @NotNull List<@NotNull Long> workerIds) {}
}
