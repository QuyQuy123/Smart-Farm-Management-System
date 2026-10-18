package com.farmshift.backendFarmShift.controller;

import com.farmshift.backendFarmShift.dto.request.CustomerContactRequest;
import com.farmshift.backendFarmShift.dto.response.CustomerContactResponse;
import com.farmshift.backendFarmShift.dto.response.CustomerContactPage;
import com.farmshift.backendFarmShift.dto.response.ApiResponse;
import com.farmshift.backendFarmShift.service.CustomerContactService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/customer-contacts") @RequiredArgsConstructor
public class CustomerContactController {
    private final CustomerContactService service;
    @GetMapping public ApiResponse<CustomerContactPage> list(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "") String q) { return ApiResponse.success("Danh sách khách hàng", service.list(page, q)); }
    @GetMapping("/{id}") public ApiResponse<CustomerContactResponse> get(@PathVariable Long id) { return ApiResponse.success("Chi tiết khách hàng", service.get(id)); }
    @PostMapping @ResponseStatus(HttpStatus.CREATED) @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<CustomerContactResponse> create(@Valid @RequestBody CustomerContactRequest request) { return ApiResponse.success("Đã thêm khách hàng", service.create(request)); }
    @PutMapping("/{id}") @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<CustomerContactResponse> update(@PathVariable Long id, @Valid @RequestBody CustomerContactRequest request) { return ApiResponse.success("Đã cập nhật khách hàng", service.update(id, request)); }
    @DeleteMapping("/{id}") @PreAuthorize("hasAuthority('ROLE_FARM_OWNER')")
    public ApiResponse<Void> delete(@PathVariable Long id) { service.delete(id); return ApiResponse.success("Đã xóa khách hàng"); }
}
