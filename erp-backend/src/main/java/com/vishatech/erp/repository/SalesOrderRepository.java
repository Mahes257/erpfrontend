package com.vishatech.erp.repository;

import com.vishatech.erp.entity.SalesOrder;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SalesOrderRepository extends JpaRepository<SalesOrder, Long>, JpaSpecificationExecutor<SalesOrder> {
    long countByStatus(String status);

    boolean existsBySoNo(String soNo);

    long countByCurrencyIgnoreCase(String currency);

    long countByPaymentTermsIgnoreCase(String paymentTerms);

    long countByDeliveryTermsIgnoreCase(String deliveryTerms);

    long countBySalesExecutiveIgnoreCase(String salesExecutive);

    long countByCityIgnoreCase(String city);

    long countByStateIgnoreCase(String state);

    @Query("SELECT COALESCE(SUM(o.grandTotal), 0) FROM SalesOrder o WHERE o.status NOT IN :excluded")
    BigDecimal sumGrandTotalExcluding(@Param("excluded") List<String> excluded);
}
