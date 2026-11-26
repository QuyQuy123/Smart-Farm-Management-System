package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.CycleOpenedFeed;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface CycleOpenedFeedRepository extends JpaRepository<CycleOpenedFeed, Long> {
    @EntityGraph(attributePaths = {"product", "warehouse", "unit", "cycle"})
    List<CycleOpenedFeed> findAllByCycleIdOrderByIdAsc(Long cycleId);

    @EntityGraph(attributePaths = {"product", "warehouse", "unit", "cycle"})
    List<CycleOpenedFeed> findAllByCycleIdInOrderByIdAsc(Collection<Long> cycleIds);

    @EntityGraph(attributePaths = {"product", "warehouse", "unit", "cycle"})
    Optional<CycleOpenedFeed> findByCycleIdAndProductId(Long cycleId, Long productId);

    @EntityGraph(attributePaths = {"product", "warehouse", "unit", "cycle"})
    List<CycleOpenedFeed> findAllByCycleIdAndRemainingKgGreaterThanOrderByIdAsc(Long cycleId, BigDecimal zero);
}
