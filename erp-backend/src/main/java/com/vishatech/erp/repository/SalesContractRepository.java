package com.vishatech.erp.repository;

import com.vishatech.erp.entity.SalesContract;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SalesContractRepository extends JpaRepository<SalesContract, Long>, JpaSpecificationExecutor<SalesContract> {
    long countByStatus(String status);

    boolean existsByScNo(String scNo);

    long countByCurrencyIgnoreCase(String currency);

    long countByPaymentTermsIgnoreCase(String paymentTerms);

    long countByDeliveryTermsIgnoreCase(String deliveryTerms);

    long countBySalesExecutiveIgnoreCase(String salesExecutive);

    long countByDurationIgnoreCase(String duration);

    long countByWarrantyIgnoreCase(String warranty);

    long countByCityIgnoreCase(String city);

    long countByStateIgnoreCase(String state);

    @Query("SELECT COALESCE(SUM(c.grandTotal), 0) FROM SalesContract c WHERE c.status NOT IN :excluded")
    BigDecimal sumGrandTotalExcluding(@Param("excluded") List<String> excluded);
}
