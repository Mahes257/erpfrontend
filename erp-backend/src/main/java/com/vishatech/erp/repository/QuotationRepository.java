package com.vishatech.erp.repository;

import com.vishatech.erp.entity.Quotation;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface QuotationRepository extends JpaRepository<Quotation, Long>, JpaSpecificationExecutor<Quotation> {
    long countByStatus(String status);

    boolean existsByQuotationNo(String quotationNo);

    long countByCurrencyIgnoreCase(String currency);

    long countByPaymentTermsIgnoreCase(String paymentTerms);

    long countByDeliveryTermsIgnoreCase(String deliveryTerms);

    long countByCityIgnoreCase(String city);

    long countByStateIgnoreCase(String state);

    long countByFromCompanyIgnoreCase(String fromCompany);

    @Query("SELECT COALESCE(SUM(q.grandTotal), 0) FROM Quotation q WHERE q.status NOT IN :excluded")
    BigDecimal sumGrandTotalExcluding(@Param("excluded") List<String> excluded);
}
