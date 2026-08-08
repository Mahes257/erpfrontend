package com.vishatech.erp.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CprCommentRequest(
        @NotBlank(message = "Comment text is required")
        @Size(max = 1000, message = "Comment cannot exceed 1000 characters")
        String text
) {
}
