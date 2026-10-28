package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.BarnWorker;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import java.util.List;

public interface BarnWorkerRepository extends JpaRepository<BarnWorker, Long> {
    @EntityGraph(attributePaths = "worker")
    List<BarnWorker> findAllByOrderByIdAsc();
    @EntityGraph(attributePaths = "worker")
    List<BarnWorker> findAllByBarnIdOrderByIdAsc(Long barnId);
    List<BarnWorker> findAllByWorkerEmailIgnoreCase(String email);
    boolean existsByBarnIdAndWorkerId(Long barnId, Long workerId);
    boolean existsByBarnIdAndWorkerEmailIgnoreCase(Long barnId, String email);
    @Modifying(flushAutomatically = true)
    void deleteAllByBarnId(Long barnId);
}
