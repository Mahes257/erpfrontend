package com.vishatech.erp.repository;

import com.vishatech.erp.entity.Invoice;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface InvoiceRepository extends JpaRepository<Invoice, Long>, JpaSpecificationExecutor<Invoice> {
    long countByStatus(String status);

    boolean existsByInvoiceNo(String invoiceNo);

    long countByBankTypeIgnoreCase(String bankType);

    @Query("SELECT COALESCE(SUM(i.grandTotal), 0) FROM Invoice i WHERE i.status NOT IN :excluded")
    BigDecimal sumGrandTotalExcluding(@Param("excluded") List<String> excluded);
}
