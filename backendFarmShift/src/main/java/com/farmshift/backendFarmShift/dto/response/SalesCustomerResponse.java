package com.farmshift.backendFarmShift.dto.response;

import com.farmshift.backendFarmShift.entity.Customer;
import java.math.BigDecimal;

public record SalesCustomerResponse(Long id, String name, String phone, String address,
                                    BigDecimal totalBought, BigDecimal debt, String note) {
    public static SalesCustomerResponse from(Customer customer) {
        return new SalesCustomerResponse(customer.getId(), customer.getFullName(), customer.getPhone(),
                customer.getAddress(), customer.getTotalBought(), customer.getDebt(), customer.getNote());
    }
}
