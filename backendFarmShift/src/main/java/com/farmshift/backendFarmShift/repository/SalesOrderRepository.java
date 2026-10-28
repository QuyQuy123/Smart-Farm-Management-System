package com.farmshift.backendFarmShift.repository;
import com.farmshift.backendFarmShift.entity.SalesOrder;
import org.springframework.data.jpa.repository.JpaRepository;
public interface SalesOrderRepository extends JpaRepository<SalesOrder, String> { @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
 @org.springframework.data.jpa.repository.Query("select o from SalesOrder o where o.id = :id")
 java.util.Optional<SalesOrder> findForUpdate(@org.springframework.data.repository.query.Param("id") String id);
 boolean existsByCode(String code); }
