package com.farmshift.backendFarmShift.service.impl;

import com.farmshift.backendFarmShift.entity.InternalStockVoucherNumber;
import com.farmshift.backendFarmShift.repository.InternalStockVoucherNumberRepository;
import com.farmshift.backendFarmShift.repository.InternalStockVoucherRepository;
import com.farmshift.backendFarmShift.service.InternalStockCodeGenerator;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class InternalStockCodeServiceImpl implements InternalStockCodeGenerator {
    private final InternalStockVoucherNumberRepository numbers;
    private final InternalStockVoucherRepository vouchers;

    @Override
    @Transactional
    public String nextCode() {
        String code;
        do {
            Long num = numbers.saveAndFlush(new InternalStockVoucherNumber()).getId();
            code = "XNB" + String.format(java.util.Locale.ROOT, "%06d", num);
        } while (vouchers.existsByCode(code));
        return code;
    }
}
