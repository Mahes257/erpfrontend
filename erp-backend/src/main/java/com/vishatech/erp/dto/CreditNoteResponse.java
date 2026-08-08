package com.vishatech.erp.dto;

import java.math.BigDecimal;
import java.util.List;

public record CreditNoteResponse(
        Long id,
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
        BigDecimal subTotal,
        BigDecimal discount,
        BigDecimal discountPct,
        BigDecimal cgstTotal,
        BigDecimal sgstTotal,
        BigDecimal taxTotal,
        BigDecimal charges,
        BigDecimal grandTotal,
        Integer itemsCount,
        BigDecimal totalQty,
        String date,
        String createdAt,
        String updatedAt,
        String archivedAt,
        List<CreditNoteItemResponse> items,
        List<SalesAttachmentResponse> attachments,
        List<SalesTimelineResponse> timeline,
        List<SalesHistoryResponse> history
) {
}
