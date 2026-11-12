package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.CashFund;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface CashFundRepository extends JpaRepository<CashFund, Long> {
    @Modifying(flushAutomatically = true)
    @Query("update CashFund f set f.balance = f.balance - :amount where f.id = :id and f.balance >= :amount")
    int takeBalance(@Param("id") Long id, @Param("amount") long amount);

    @Modifying(flushAutomatically = true)
    @Query("update CashFund f set f.balance = f.balance + :amount where f.id = :id")
    int addBalance(@Param("id") Long id, @Param("amount") long amount);

    boolean existsByNameIgnoreCaseAndIdNot(String name, Long id);
    Optional<CashFund> findFirstByNameIgnoreCase(String name);
}

