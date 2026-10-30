package com.farmshift.backendFarmShift.config;

import com.farmshift.backendFarmShift.repository.SupplierRepository;
import com.farmshift.backendFarmShift.service.SupplierService;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Scope the existing unique index to name/group without replacing supplier IDs or invoice references. */
@Component @RequiredArgsConstructor
public class SupplierNameKeyUpgrade implements ApplicationRunner {
    private final SupplierRepository suppliers;
    @Override @Transactional
    public void run(ApplicationArguments args) {
        for (var supplier : suppliers.findAll()) {
            String key = SupplierService.nameKey(supplier.getName(), supplier.getProductType().getId());
            if (!key.equals(supplier.getNameKey())) supplier.setNameKey(key);
        }
        suppliers.flush();
    }
}
