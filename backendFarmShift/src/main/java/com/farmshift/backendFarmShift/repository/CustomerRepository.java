package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.Account;
import com.farmshift.backendFarmShift.entity.Customer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface CustomerRepository extends JpaRepository<Customer, Long>, JpaSpecificationExecutor<Customer> {
    Optional<Customer> findByAccount(Account account);

    /** Batch lookup to avoid N+1 queries when listing employees. */
    List<Customer> findByAccountIn(Collection<Account> accounts);
}
