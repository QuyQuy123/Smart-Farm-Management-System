package com.farmshift.backendFarmShift.controller;

import com.farmshift.backendFarmShift.dto.response.ApiResponse;
import com.farmshift.backendFarmShift.dto.response.SalesCustomerResponse;
import com.farmshift.backendFarmShift.repository.CustomerContactRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/sales/customers")
@RequiredArgsConstructor
public class SalesCustomerController {
    private final CustomerContactRepository customers;

    @GetMapping
    @PreAuthorize("hasAnyAuthority('ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT')")
    public ApiResponse<List<SalesCustomerResponse>> list() {
        return ApiResponse.success("Danh sách khách hàng", customers.findAll(Sort.by("name").ascending())
                .stream().map(SalesCustomerResponse::from).toList());
    }
}
