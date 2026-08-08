package com.vishatech.erp.repository;

import com.vishatech.erp.entity.SalesHistory;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SalesHistoryRepository extends JpaRepository<SalesHistory, Long> {
    List<SalesHistory> findByModuleTypeAndModuleIdOrderByCreatedAtAsc(String moduleType, Long moduleId);

    void deleteByModuleTypeAndModuleId(String moduleType, Long moduleId);
}
