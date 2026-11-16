package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.CustomerContact;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface CustomerContactRepository extends JpaRepository<CustomerContact, Long> {
    java.util.Optional<CustomerContact> findFirstByPhoneAndNameIgnoreCaseOrderByIdAsc(String phone, String name);
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    java.util.Optional<CustomerContact> findTopByPhoneAndNameIgnoreCaseOrderByIdAsc(String phone, String name);
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select c from CustomerContact c where c.id = :id")
    java.util.Optional<CustomerContact> findForUpdate(@org.springframework.data.repository.query.Param("id") Long id);
    Page<CustomerContact> findByNameContainingIgnoreCaseOrPhoneContaining(String name, String phone, Pageable pageable);
}
