package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.CashFundTransfer;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CashFundTransferRepository extends JpaRepository<CashFundTransfer, Long> {
    @EntityGraph(attributePaths = {"fromFund", "toFund"})
    List<CashFundTransfer> findAllByOrderByTransferDateDescIdDesc();

    Optional<CashFundTransfer> findByCode(String code);

    boolean existsByFromFund_IdOrToFund_Id(Long fromFundId, Long toFundId);
}

