package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.PayrollRecord;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PayrollRecordRepository extends JpaRepository<PayrollRecord, Long> {
    @EntityGraph(attributePaths = {"account"})
    List<PayrollRecord> findAllByOrderByPayPeriodDescIdDesc();

    Optional<PayrollRecord> findByCode(String code);
}

