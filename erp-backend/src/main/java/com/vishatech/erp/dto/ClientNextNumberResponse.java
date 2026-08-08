package com.vishatech.erp.dto;

public record ClientNextNumberResponse(
        String clientNo,
        long nextNumber
) {
}
