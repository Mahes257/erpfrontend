package com.vishatech.erp.dto;

import java.math.BigDecimal;
import java.util.List;

public record CostWorkoutItemRequest(
        String description,
        BigDecimal qty,
        String unit,
        List<CostWorkoutCategoryRequest> categories
) {
}
