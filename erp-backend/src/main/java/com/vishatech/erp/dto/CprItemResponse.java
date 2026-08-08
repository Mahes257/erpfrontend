package com.vishatech.erp.dto;

import java.math.BigDecimal;
import java.util.List;

public record CprItemResponse(
        Long id,
        String drawingNo,
        String description,
        String specification,
        BigDecimal qty,
        String unit,
        BigDecimal estimatedCost,
        String remarks,
        String fileName,
        Long fileSize,
        String fileType
) {
}
