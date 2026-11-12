package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.CashTransactionCategory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CashTransactionCategoryRepository extends JpaRepository<CashTransactionCategory, Long> {
    List<CashTransactionCategory> findAllByOrderByTypeAscIdAsc();
    boolean existsByNameKeyAndIdNot(String nameKey, Long id);
}

