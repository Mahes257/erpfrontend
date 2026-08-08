package com.vishatech.erp.dto;

import jakarta.validation.constraints.NotBlank;

public record NoteRequest(
        @NotBlank(message = "Note text is required") String text
) {
}
