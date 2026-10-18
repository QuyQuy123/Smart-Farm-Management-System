package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.Barn;
import com.farmshift.backendFarmShift.entity.BarnStatus;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface BarnRepository extends JpaRepository<Barn, Long> {
    @EntityGraph(attributePaths = "area")
    List<Barn> findAllByOrderByCreatedAtAscIdAsc();
    @EntityGraph(attributePaths = "area")
    List<Barn> findAllByAreaIdOrderByCreatedAtAscIdAsc(Long areaId);
    boolean existsByAreaIdAndNameKey(Long areaId, String nameKey);
    boolean existsByAreaIdAndNameKeyAndIdNot(Long areaId, String nameKey, Long id);
    long countByAreaId(Long areaId);

    /** Tổng hợp theo khu: [areaId, số chuồng, số chuồng đang hoạt động, tổng số con, tổng sức chứa]. */
    @Query("""
            select b.area.id, count(b), sum(case when b.status = :active then 1 else 0 end),
                   coalesce(sum(b.currentQuantity), 0), coalesce(sum(b.capacity), 0)
            from Barn b group by b.area.id""")
    List<Object[]> summarizeByArea(@Param("active") BarnStatus active);
}
