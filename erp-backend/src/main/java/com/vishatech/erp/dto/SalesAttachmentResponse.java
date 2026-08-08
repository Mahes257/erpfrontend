package com.vishatech.erp.dto;

public record SalesAttachmentResponse(
        Long id,
        String name,
        String contentType,
        Long size,
        String url,
        String uploadedAt
) {
}
