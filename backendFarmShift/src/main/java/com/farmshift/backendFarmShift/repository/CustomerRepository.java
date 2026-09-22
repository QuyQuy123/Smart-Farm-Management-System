package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.Account;
import com.farmshift.backendFarmShift.entity.Customer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CustomerRepository extends JpaRepository<Customer, Long> {
    Optional<Customer> findByAccount(Account account);
}
