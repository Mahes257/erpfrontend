package com.vishatech.erp.dto;

import java.math.BigDecimal;
import java.util.List;

public record CreditNoteRequest(
        String cnNo,
        String cnDate,
        String status,
        String source,
        String sourceRef,
        String reason,
        BigDecimal refundAmount,
        BigDecimal returnQty,
        String reasonDetail,
        String inventoryImpact,
        String companyName,
        String companyGstin,
        String companyPan,
        String companyState,
        String companyAddress,
        Long clientId,
        String clientName,
        String contactPerson,
        String gstin,
        String email,
        String phone,
        BigDecimal discountPct,
        BigDecimal charges,
        List<CreditNoteItemRequest> items
) {
}
