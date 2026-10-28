package com.farmshift.backendFarmShift.config;

import com.farmshift.backendFarmShift.repository.BrandRepository;
import com.farmshift.backendFarmShift.service.BrandService;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Retains the unique database index while scoping its key to name and product type. */
@Component @RequiredArgsConstructor
public class BrandNameKeyUpgrade implements ApplicationRunner {
    private final BrandRepository brands;
    @Override @Transactional
    public void run(ApplicationArguments args) {
        for (var brand : brands.findAll()) {
            String key = BrandService.nameKey(brand.getName(), brand.getProductType());
            if (!key.equals(brand.getNameKey())) {
                brand.setNameKey(key);
                brands.save(brand);
            }
        }
        brands.flush();
    }
}
