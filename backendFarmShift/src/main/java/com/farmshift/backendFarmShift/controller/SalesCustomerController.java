package com.farmshift.backendFarmShift.controller;

import com.farmshift.backendFarmShift.dto.response.ApiResponse;
import com.farmshift.backendFarmShift.dto.response.SalesCustomerResponse;
import com.farmshift.backendFarmShift.repository.CustomerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/sales/customers")
@RequiredArgsConstructor
public class SalesCustomerController {
    private final CustomerRepository customers;

    @GetMapping
    public ApiResponse<List<SalesCustomerResponse>> list() {
        return ApiResponse.success("Danh sách khách hàng", customers.findAll(Sort.by("fullName").ascending())
                .stream().map(SalesCustomerResponse::from).toList());
    }
}
