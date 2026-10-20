package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.FarmArea;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FarmAreaRepository extends JpaRepository<FarmArea, Long> {
    boolean existsByNameKey(String nameKey);
    boolean existsByNameKeyAndIdNot(String nameKey, Long id);
}
