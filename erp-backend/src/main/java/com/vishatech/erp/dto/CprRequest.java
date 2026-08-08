package com.vishatech.erp.dto;

import jakarta.validation.constraints.NotBlank;
import java.math.BigDecimal;
import java.util.List;

public record CprRequest(
        String prNo,
        String prDate,
        String department,
        String requestedBy,
        String requiredDate,
        String priority,
        String status,
        String sourceLead,
        String clientName,
        String contactPerson,
        String phone,
        String email,
        String company,
        String gst,
        String project,
        String leadNo,
        String pan,
        String vendor,
        String billingAddress,
        String shippingAddress,
        String remarks,
        String description,
        String currentStage,
        String approvalStatus,
        BigDecimal costWorkout,
        BigDecimal profitPercent,
        String convertedToQtn,
        List<CprItemRequest> items
) {
}
