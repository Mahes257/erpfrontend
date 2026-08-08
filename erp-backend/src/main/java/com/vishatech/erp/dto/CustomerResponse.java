package com.vishatech.erp.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record CustomerResponse(
        Long id,
        String businessName,
        String clientCode,
        String alias,
        String contactPerson,
        String email,
        String phone,
        String gstin,
        String pan,
        String billingAddress,
        String billingCity,
        String billingState,
        String billingPin,
        String shippingAddress,
        String shippingCity,
        String shippingState,
        String shippingPin,
        String country,
        String paymentTerms,
        BigDecimal creditLimit,
        String salesPerson,
        String category,
        String status,
        String notes,
        LocalDateTime createdAt
) {
}
