package com.vishatech.erp.dto;

public record TimelineResponse(
        Long id,
        String type,
        String title,
        String detail,
        String date
) {
}
