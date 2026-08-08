package com.vishatech.erp.repository;

import com.vishatech.erp.entity.Cpr;
import com.vishatech.erp.entity.CprStatus;
import java.math.BigDecimal;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CprRepository extends JpaRepository<Cpr, Long>, JpaSpecificationExecutor<Cpr> {
    long countByStatus(CprStatus status);

    long countByDepartmentIgnoreCase(String department);

    long countByPriorityIgnoreCase(String priority);

    long countByRequestedByIgnoreCase(String requestedBy);

    boolean existsByPrNo(String prNo);

    java.util.Optional<Cpr> findByPrNo(String prNo);

    @Query("SELECT COALESCE(SUM(c.grandTotal), 0) FROM Cpr c WHERE c.status NOT IN :excluded")
    BigDecimal sumGrandTotalExcluding(@Param("excluded") java.util.Collection<CprStatus> excluded);
}
