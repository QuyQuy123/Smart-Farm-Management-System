package com.farmshift.backendFarmShift.controller;
import com.farmshift.backendFarmShift.entity.SalesOrder;
import com.farmshift.backendFarmShift.dto.request.SalesOrderRequest;
import com.farmshift.backendFarmShift.dto.response.ApiResponse;
import com.farmshift.backendFarmShift.repository.SalesOrderRepository;
import com.farmshift.backendFarmShift.service.SalesOrderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import java.util.List;
@RestController @RequestMapping("/api/sales/orders") @RequiredArgsConstructor
public class SalesOrderController {
 private final SalesOrderRepository orders;
 private final SalesOrderService service;
 private final com.farmshift.backendFarmShift.service.SalesInvoiceService invoiceService;
 @GetMapping("/{id}/invoice")
 public ApiResponse<com.farmshift.backendFarmShift.dto.response.SalesInvoiceResponse> invoice(@PathVariable String id) {
  return ApiResponse.success("Thông tin hóa đơn bán hàng", invoiceService.get(id));
 }
 @GetMapping public ApiResponse<List<SalesOrder>> list() {
  return ApiResponse.success("Danh sách đơn bán", orders.findAll(Sort.by("date").descending().and(Sort.by("id").descending())));
 }
 @PostMapping @PreAuthorize("hasAnyAuthority('ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT')")
 public ApiResponse<SalesOrder> create(@Valid @RequestBody SalesOrderRequest request) {
  return ApiResponse.success("Đã lưu đơn bán", service.create(request));
 }
 @PutMapping("/{id}") public ApiResponse<SalesOrder> update(@PathVariable String id, @Valid @RequestBody SalesOrderRequest request) {
  return ApiResponse.success("Đã cập nhật hóa đơn", service.update(id, request));
 }
}
