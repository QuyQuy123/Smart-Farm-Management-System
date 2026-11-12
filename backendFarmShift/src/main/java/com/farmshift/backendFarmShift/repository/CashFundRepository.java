package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.CashFund;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CashFundRepository extends JpaRepository<CashFund, Long> {
    boolean existsByNameIgnoreCaseAndIdNot(String name, Long id);
    Optional<CashFund> findFirstByNameIgnoreCase(String name);
}

