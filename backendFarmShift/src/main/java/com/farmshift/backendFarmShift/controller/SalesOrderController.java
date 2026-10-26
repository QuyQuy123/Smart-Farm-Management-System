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
import java.util.List;
@RestController @RequestMapping("/api/sales/orders") @RequiredArgsConstructor
public class SalesOrderController {
 private final SalesOrderRepository orders;
 private final SalesOrderService service;
 @GetMapping public ApiResponse<List<SalesOrder>> list() {
  return ApiResponse.success("Danh sách đơn bán", orders.findAll(Sort.by("date").descending().and(Sort.by("id").descending())));
 }
 @PostMapping public ApiResponse<SalesOrder> create(@Valid @RequestBody SalesOrderRequest request) {
  return ApiResponse.success("Đã lưu đơn bán", service.create(request));
 }
}
