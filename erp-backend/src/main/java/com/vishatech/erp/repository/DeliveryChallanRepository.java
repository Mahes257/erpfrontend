package com.vishatech.erp.repository;

import com.vishatech.erp.entity.DeliveryChallan;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DeliveryChallanRepository extends JpaRepository<DeliveryChallan, Long>, JpaSpecificationExecutor<DeliveryChallan> {
    long countByStatus(String status);

    boolean existsByDcNo(String dcNo);

    long countByTransportCompanyIgnoreCase(String transportCompany);

    long countByCityIgnoreCase(String city);

    long countByStateIgnoreCase(String state);

    @Query("SELECT COALESCE(SUM(d.grandTotal), 0) FROM DeliveryChallan d WHERE d.status NOT IN :excluded")
    BigDecimal sumGrandTotalExcluding(@Param("excluded") List<String> excluded);
}
