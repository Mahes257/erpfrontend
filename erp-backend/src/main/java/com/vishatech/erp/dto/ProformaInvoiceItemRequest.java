package com.vishatech.erp.dto;

import java.math.BigDecimal;

public record ProformaInvoiceItemRequest(
        Long id,
        String description,
        String sku,
        String hsn,
        String uom,
        BigDecimal qty,
        BigDecimal rate,
        BigDecimal discountPct,
        BigDecimal gstRate
) {
}
