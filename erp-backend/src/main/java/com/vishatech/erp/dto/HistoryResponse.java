package com.vishatech.erp.dto;

public record HistoryResponse(
        Long id,
        String field,
        String oldValue,
        String newValue,
        String changedBy,
        String date
) {
}
