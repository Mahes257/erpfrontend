package com.vishatech.erp.repository;

import com.vishatech.erp.entity.Lead;
import com.vishatech.erp.entity.LeadStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface LeadRepository extends JpaRepository<Lead, Long>, JpaSpecificationExecutor<Lead> {
    long countByStatus(LeadStatus status);

    boolean existsByLeadNo(String leadNo);

    @Query("SELECT leadNo FROM Lead WHERE leadNo LIKE 'LEAD-%'")
    List<String> findAllLeadNos();

    @Query(value = "SELECT current_value FROM auto_number_sequences WHERE module = 'LEAD'", nativeQuery = true)
    Optional<Long> findLeadSequenceValue();

    @Transactional
    @Modifying
    @Query(value = "INSERT INTO auto_number_sequences (module, prefix, current_value) VALUES ('LEAD', 'LEAD-', :value) "
            + "ON DUPLICATE KEY UPDATE current_value = :value", nativeQuery = true)
    void upsertLeadSequence(@Param("value") long value);

    @Query(value = "SELECT current_value FROM auto_number_sequences WHERE module = 'CLIENT'", nativeQuery = true)
    Optional<Long> findClientSequenceValue();

    @Transactional
    @Modifying
    @Query(value = "INSERT INTO auto_number_sequences (module, prefix, current_value) VALUES ('CLIENT', 'CLIENT-', :value) "
            + "ON DUPLICATE KEY UPDATE current_value = :value", nativeQuery = true)
    void upsertClientSequence(@Param("value") long value);

    // Client numbers are persisted inside the internalNotes meta blob
    // ({\"__crmMeta\":{\"clientNo\":\"C-000014\",...}}) by the frontend.
    @Query(value = "SELECT internal_notes FROM leads WHERE internal_notes LIKE '%clientNo%'", nativeQuery = true)
    List<String> findClientNumberBlobs();
}
