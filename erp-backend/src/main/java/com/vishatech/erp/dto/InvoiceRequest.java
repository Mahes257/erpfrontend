package com.vishatech.erp.dto;

import java.math.BigDecimal;
import java.util.List;

public record InvoiceRequest(
        String invoiceNo,
        String companyName,
        String companyGstin,
        String companyPan,
        String companyState,
        String companyAddress,
        String invoiceDate,
        String dueDate,
        String referenceNo,
        String source,
        String sourceRef,
        String status,
        String paymentStatus,
        String bankName,
        String bankAccount,
        String bankIfsc,
        String bankBranch,
        String bankType,
        String bankUpi,
        Long clientId,
        String clientName,
        String contactPerson,
        String gstin,
        String pan,
        String email,
        String phone,
        String billingAddress,
        Boolean shipSameAsBill,
        String shippingAddress,
        String terms,
        String notes,
        BigDecimal discountPct,
        BigDecimal charges,
        List<InvoiceItemRequest> items
) {
}
