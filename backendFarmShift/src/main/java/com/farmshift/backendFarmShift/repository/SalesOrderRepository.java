package com.farmshift.backendFarmShift.repository;
import com.farmshift.backendFarmShift.entity.SalesOrder;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDate;
import java.util.List;
public interface SalesOrderRepository extends JpaRepository<SalesOrder, String> { @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
 @org.springframework.data.jpa.repository.Query("select o from SalesOrder o where o.id = :id")
 java.util.Optional<SalesOrder> findForUpdate(@org.springframework.data.repository.query.Param("id") String id);
 boolean existsByCode(String code);

 @EntityGraph(attributePaths = {"cycle", "cycle.barn", "cycle.barn.area", "harvestMovement"})
 @Query("select o from SalesOrder o order by o.date desc, o.id desc")
 List<SalesOrder> findAllWithCycleForReport();

 @EntityGraph(attributePaths = {"cycle", "cycle.barn", "cycle.barn.area", "harvestMovement"})
 @Query("select o from SalesOrder o where o.date between :from and :to order by o.date desc, o.id desc")
 List<SalesOrder> findInDateRangeForReport(@Param("from") LocalDate from, @Param("to") LocalDate to);
}
