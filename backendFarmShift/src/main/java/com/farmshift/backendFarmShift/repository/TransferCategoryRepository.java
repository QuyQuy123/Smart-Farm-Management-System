package com.farmshift.backendFarmShift.repository;
import com.farmshift.backendFarmShift.entity.TransferCategory;
import org.springframework.data.jpa.repository.JpaRepository;
public interface TransferCategoryRepository extends JpaRepository<TransferCategory, Long> {
    boolean existsByTypeAndNameKeyAndIdNot(String type, String nameKey, Long id);
}
