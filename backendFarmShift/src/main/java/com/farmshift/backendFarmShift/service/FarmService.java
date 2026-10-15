package com.farmshift.backendFarmShift.service;

import com.farmshift.backendFarmShift.dto.request.UpdateFarmRequest;
import com.farmshift.backendFarmShift.entity.Farm;
import com.farmshift.backendFarmShift.repository.FarmRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class FarmService {
    private final FarmRepository repository;
    private static final long CURRENT_FARM_ID = 1L;

    @Transactional(readOnly = true)
    public Farm getCurrentFarm() {
        return repository.findById(CURRENT_FARM_ID).orElse(null);
    }

    @Transactional
    public Farm updateCurrentFarm(UpdateFarmRequest request) {
        Farm farm = repository.findById(CURRENT_FARM_ID).orElseGet(Farm::new);
        farm.setId(CURRENT_FARM_ID);
        farm.setName(request.getName().trim());
        farm.setOwner(request.getOwner().trim());
        farm.setPhone(request.getPhone().trim());
        farm.setScale(clean(request.getScale()));
        farm.setAddress(clean(request.getAddress()));
        farm.setType(clean(request.getType()));
        return repository.saveAndFlush(farm);
    }

    private String clean(String value) {
        return value == null ? "" : value.trim();
    }
}
