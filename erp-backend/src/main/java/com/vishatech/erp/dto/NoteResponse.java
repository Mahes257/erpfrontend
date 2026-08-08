package com.vishatech.erp.dto;

public record NoteResponse(
        Long id,
        String text,
        String author,
        String date
) {
}
