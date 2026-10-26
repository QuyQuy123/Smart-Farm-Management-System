package com.farmshift.backendFarmShift.repository;
import com.farmshift.backendFarmShift.entity.SalesOrder;
import org.springframework.data.jpa.repository.JpaRepository;
public interface SalesOrderRepository extends JpaRepository<SalesOrder, String> { boolean existsByCode(String code); }
