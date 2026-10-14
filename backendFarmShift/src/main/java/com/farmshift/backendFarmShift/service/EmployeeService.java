package com.farmshift.backendFarmShift.service;

import com.farmshift.backendFarmShift.dto.request.EmployeeCreateRequest;
import com.farmshift.backendFarmShift.dto.request.EmployeeUpdateRequest;
import com.farmshift.backendFarmShift.dto.response.EmployeeResponse;

import java.util.List;

public interface EmployeeService {

    /**
     * @param keyword  matches full name, email or phone (optional)
     * @param role     role id or role name (optional)
     * @param isActive account status (optional)
     */
    List<EmployeeResponse> getEmployees(String keyword, String role, Boolean isActive);

    /**
     * Non-blocking multi-threaded cross-table search returning a CompletableFuture.
     */
    java.util.concurrent.CompletableFuture<List<EmployeeResponse>> getEmployeesAsync(
            String keyword, String role, Boolean isActive);

    /**
     * Computes real-time distribution metrics (active, inactive, per-role counts) concurrently.
     */
    java.util.concurrent.CompletableFuture<com.farmshift.backendFarmShift.dto.response.EmployeeSearchSummary> getEmployeeSearchSummaryAsync();

    EmployeeResponse getEmployeeById(Long id);

    EmployeeResponse createEmployee(EmployeeCreateRequest request);

    EmployeeResponse updateEmployee(Long id, EmployeeUpdateRequest request);
}
