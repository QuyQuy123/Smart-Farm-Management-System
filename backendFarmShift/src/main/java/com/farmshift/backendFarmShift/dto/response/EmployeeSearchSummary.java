package com.farmshift.backendFarmShift.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Aggregated search statistics and breakdown counts computed concurrently via thread pool.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EmployeeSearchSummary {
    private long total;
    private long active;
    private long inactive;
    private long ownerCount;
    private long accountantCount;
    private long workerCount;
}
