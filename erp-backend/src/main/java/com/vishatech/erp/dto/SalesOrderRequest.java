package com.vishatech.erp.dto;

import java.math.BigDecimal;
import java.util.List;

public record SalesOrderRequest(
        String soNo,
        String customerPo,
        String orderDate,
        String leadNo,
        String scRef,
        String qtnRef,
        String status,
        String currency,
        String priority,
        Long clientId,
        String clientName,
        String contactPerson,
        String email,
        String phone,
        String city,
        String state,
        String billingAddress,
        String shippingAddress,
        String gstin,
        String pan,
        String paymentTerms,
        String salesExecutive,
        String deliveryDate,
        String deliveryTerms,
        String terms,
        String remarks,
        BigDecimal discount,
        BigDecimal charges,
        List<SalesOrderItemRequest> items
) {
}
