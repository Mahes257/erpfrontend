package com.vishatech.erp.dto;

import jakarta.validation.constraints.NotBlank;

public record AssignOwnerRequest(
        @NotBlank(message = "Owner is required") String owner
) {
}
