package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.CustomerContact;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface CustomerContactRepository extends JpaRepository<CustomerContact, Long> {
    java.util.Optional<CustomerContact> findFirstByPhoneAndNameIgnoreCaseOrderByIdAsc(String phone, String name);
    Page<CustomerContact> findByNameContainingIgnoreCaseOrPhoneContaining(String name, String phone, Pageable pageable);
}
