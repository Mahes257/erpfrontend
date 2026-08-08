package com.vishatech.erp.repository;

import com.vishatech.erp.entity.CostWorkout;
import com.vishatech.erp.entity.CostWorkoutStatus;
import java.math.BigDecimal;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface CostWorkoutRepository extends JpaRepository<CostWorkout, Long>, JpaSpecificationExecutor<CostWorkout> {
    long countByStatus(CostWorkoutStatus status);

    long countByDepartmentIgnoreCase(String department);

    long countByPreparedByIgnoreCase(String preparedBy);

    boolean existsByCwNo(String cwNo);

    @Query("SELECT COALESCE(SUM(c.grandTotal), 0) FROM CostWorkout c WHERE c.status NOT IN :excluded")
    BigDecimal sumGrandTotalExcluding(@Param("excluded") java.util.Collection<CostWorkoutStatus> excluded);

    /** Detach the given CPR from all linked Cost Workouts (keeps FK integrity). */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Transactional
    @Query("UPDATE CostWorkout cw SET cw.cpr = NULL WHERE cw.cpr.id = :cprId")
    int unlinkByCprId(@Param("cprId") Long cprId);
}
