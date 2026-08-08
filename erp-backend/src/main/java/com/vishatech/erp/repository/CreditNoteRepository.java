package com.vishatech.erp.repository;

import com.vishatech.erp.entity.CreditNote;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CreditNoteRepository extends JpaRepository<CreditNote, Long>, JpaSpecificationExecutor<CreditNote> {
    long countByStatus(String status);

    boolean existsByCnNo(String cnNo);

    long countByReasonIgnoreCase(String reason);

    @Query("SELECT COALESCE(SUM(c.grandTotal), 0) FROM CreditNote c WHERE c.status NOT IN :excluded")
    BigDecimal sumGrandTotalExcluding(@Param("excluded") List<String> excluded);
}
