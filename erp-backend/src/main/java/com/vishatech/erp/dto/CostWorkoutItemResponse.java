package com.vishatech.erp.dto;

import java.math.BigDecimal;
import java.util.List;

public record CostWorkoutItemResponse(
        Long id,
        String description,
        BigDecimal qty,
        String unit,
        List<CostWorkoutCategoryResponse> categories
) {
}
