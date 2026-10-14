package com.farmshift.backendFarmShift.controller;

import com.farmshift.backendFarmShift.dto.request.EmployeeCreateRequest;
import com.farmshift.backendFarmShift.dto.request.EmployeeUpdateRequest;
import com.farmshift.backendFarmShift.dto.response.ApiResponse;
import com.farmshift.backendFarmShift.dto.response.EmployeeResponse;
import com.farmshift.backendFarmShift.service.EmployeeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Employee management API — restricted to the Farm Owner.
 *
 * <pre>
 * GET  /api/employees?keyword=&role=&isActive=   list + search/filter
 * GET  /api/employees/{id}                       details
 * POST /api/employees                            create (201)
 * PUT  /api/employees/{id}                       update info / role / status
 * </pre>
 */
@RestController
@RequestMapping("/api/employees")
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
public class EmployeeController {

    private final EmployeeService employeeService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<EmployeeResponse>>> getEmployees(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) Boolean isActive) {

        List<EmployeeResponse> employees = employeeService.getEmployees(keyword, role, isActive);
        return ResponseEntity.ok(ApiResponse.success("Employees fetched successfully", employees));
    }

    @GetMapping("/summary")
    public ResponseEntity<ApiResponse<com.farmshift.backendFarmShift.dto.response.EmployeeSearchSummary>> getSearchSummary() {
        return ResponseEntity.ok(ApiResponse.success(
                "Employee search summary fetched successfully",
                employeeService.getEmployeeSearchSummaryAsync().join()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<EmployeeResponse>> getEmployee(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(
                "Employee fetched successfully", employeeService.getEmployeeById(id)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<EmployeeResponse>> createEmployee(
            @Valid @RequestBody EmployeeCreateRequest request) {

        EmployeeResponse created = employeeService.createEmployee(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Employee created successfully", created));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<EmployeeResponse>> updateEmployee(
            @PathVariable Long id,
            @Valid @RequestBody EmployeeUpdateRequest request) {

        return ResponseEntity.ok(ApiResponse.success(
                "Employee updated successfully", employeeService.updateEmployee(id, request)));
    }
}
