package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.FarmAsset;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FarmAssetRepository extends JpaRepository<FarmAsset, Long> {
    List<FarmAsset> findAllByOrderByIdDesc();
    Optional<FarmAsset> findByCode(String code);
}

