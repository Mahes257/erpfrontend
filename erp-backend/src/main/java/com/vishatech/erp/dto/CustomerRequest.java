package com.vishatech.erp.dto;

import jakarta.validation.constraints.NotBlank;
import java.math.BigDecimal;

public record CustomerRequest(
        @NotBlank(message = "Business name is required") String businessName,
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
        String notes
) {
}
