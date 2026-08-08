package com.vishatech.erp.controller;

import com.vishatech.erp.dto.ApiResponse;
import com.vishatech.erp.dto.FinancialSettingsRequest;
import com.vishatech.erp.dto.FinancialSettingsResponse;
import com.vishatech.erp.service.ExchangeRateService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Settings → Financial Settings (base currency etc.).
 *   GET /settings/financial        -> current base currency + last-updated
 *   PUT /settings/financial        -> change base currency (ADMIN only)
 */
@RestController
@RequestMapping("/settings")
public class SettingsController {

    private final ExchangeRateService exchangeRateService;

    public SettingsController(ExchangeRateService exchangeRateService) {
        this.exchangeRateService = exchangeRateService;
    }

    @GetMapping("/financial")
    public ResponseEntity<ApiResponse<FinancialSettingsResponse>> getFinancial() {
        return ResponseEntity.ok(ApiResponse.ok(exchangeRateService.getFinancial()));
    }

    @PutMapping("/financial")
    public ResponseEntity<ApiResponse<FinancialSettingsResponse>> updateFinancial(
            @Valid @RequestBody FinancialSettingsRequest request) {
        if (!exchangeRateService.isAdmin()) {
            throw new AccessDeniedException("Only an ADMIN can change the base currency");
        }
        return ResponseEntity.ok(ApiResponse.ok(exchangeRateService.setBaseCurrency(request.baseCurrency())));
    }
}
