package com.farmshift.backendFarmShift.repository;

import com.farmshift.backendFarmShift.entity.PushSubscription;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface PushSubscriptionRepository extends JpaRepository<PushSubscription, Long> {

    Optional<PushSubscription> findByEndpoint(String endpoint);

    Optional<PushSubscription> findByEndpointAndAccount_Id(String endpoint, Long accountId);

    @EntityGraph(attributePaths = {"account"})
    List<PushSubscription> findAllByAccount_IdAndActiveTrue(Long accountId);

    @EntityGraph(attributePaths = {"account"})
    List<PushSubscription> findAllByAccount_IdInAndActiveTrue(Collection<Long> accountIds);

    @EntityGraph(attributePaths = {"account"})
    List<PushSubscription> findAllByAccount_Role_NameAndActiveTrue(String roleName);

    long countByAccount_IdAndActiveTrue(Long accountId);
}
