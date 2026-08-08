package com.vishatech.erp.repository;

import com.vishatech.erp.entity.SalesAttachment;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SalesAttachmentRepository extends JpaRepository<SalesAttachment, Long> {
    List<SalesAttachment> findByModuleTypeAndModuleIdOrderByUploadedAtAsc(String moduleType, Long moduleId);

    void deleteByModuleTypeAndModuleId(String moduleType, Long moduleId);
}
