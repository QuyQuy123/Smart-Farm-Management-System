package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.CycleCostAllocation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CycleCostAllocationRepository extends JpaRepository<CycleCostAllocation, Long> {
    List<CycleCostAllocation> findAllByOrderByAllocationDateDescIdDesc();
    Optional<CycleCostAllocation> findByCode(String code);
}

