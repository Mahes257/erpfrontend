package com.vishatech.erp.repository;

import com.vishatech.erp.entity.ProformaInvoice;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProformaInvoiceRepository extends JpaRepository<ProformaInvoice, Long>, JpaSpecificationExecutor<ProformaInvoice> {
    long countByStatus(String status);

    boolean existsByPiNo(String piNo);

    long countByBankTypeIgnoreCase(String bankType);

    @Query("SELECT COALESCE(SUM(p.grandTotal), 0) FROM ProformaInvoice p WHERE p.status NOT IN :excluded")
    BigDecimal sumGrandTotalExcluding(@Param("excluded") List<String> excluded);
}
