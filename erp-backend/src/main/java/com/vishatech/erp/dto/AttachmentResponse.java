package com.vishatech.erp.dto;

public record AttachmentResponse(
        Long id,
        String name,
        String type,
        long size,
        String url,
        String date
) {
}
