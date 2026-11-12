package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.CashTransaction;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CashTransactionRepository extends JpaRepository<CashTransaction, Long> {
    @EntityGraph(attributePaths = {"fund"})
    List<CashTransaction> findAllByOrderByTxDateDescIdDesc();

    Optional<CashTransaction> findByCode(String code);

    boolean existsByFund_Id(Long fundId);
}

