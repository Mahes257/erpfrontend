package com.vishatech.erp.dto;

import java.math.BigDecimal;
import java.util.List;

public record ProformaInvoiceRequest(
        String piNo,
        String piDate,
        String referenceNo,
        String validTill,
        String source,
        String sourceRef,
        String status,
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
        String bankName,
        String bankAccount,
        String bankIfsc,
        String bankBranch,
        String bankType,
        String bankUpi,
        String terms,
        String notes,
        BigDecimal discount,
        BigDecimal discountPct,
        BigDecimal charges,
        List<ProformaInvoiceItemRequest> items
) {
}
