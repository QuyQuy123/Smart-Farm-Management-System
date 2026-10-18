package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.MeasurementUnit;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MeasurementUnitRepository extends JpaRepository<MeasurementUnit, Long> {
    boolean existsByCodeKeyAndIdNot(String key, Long id);
    boolean existsByNameKeyAndIdNot(String key, Long id);
}
