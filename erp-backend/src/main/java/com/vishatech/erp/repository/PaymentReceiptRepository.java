package com.vishatech.erp.repository;

import com.vishatech.erp.entity.PaymentReceipt;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PaymentReceiptRepository extends JpaRepository<PaymentReceipt, Long>, JpaSpecificationExecutor<PaymentReceipt> {
    long countByStatus(String status);

    boolean existsByReceiptNo(String receiptNo);

    long countByPaymentModeIgnoreCase(String paymentMode);

    @Query("SELECT COALESCE(SUM(p.amount), 0) FROM PaymentReceipt p WHERE p.status NOT IN :excluded")
    BigDecimal sumAmountExcluding(@Param("excluded") List<String> excluded);
}
