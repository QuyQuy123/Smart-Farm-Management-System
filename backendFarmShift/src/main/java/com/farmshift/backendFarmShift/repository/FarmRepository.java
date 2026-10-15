package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.Farm;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FarmRepository extends JpaRepository<Farm, Long> {
}
