package com.vishatech.erp.repository;

import com.vishatech.erp.entity.SalesTimeline;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SalesTimelineRepository extends JpaRepository<SalesTimeline, Long> {
    List<SalesTimeline> findByModuleTypeAndModuleIdOrderByCreatedAtAsc(String moduleType, Long moduleId);

    void deleteByModuleTypeAndModuleId(String moduleType, Long moduleId);
}
