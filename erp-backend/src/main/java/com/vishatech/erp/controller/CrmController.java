package com.vishatech.erp.controller;

import com.vishatech.erp.dto.ApiResponse;
import com.vishatech.erp.dto.ClientNextNumberResponse;
import com.vishatech.erp.dto.LeadResponse;
import com.vishatech.erp.service.LeadService;
import java.math.BigDecimal;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class CrmController {

    private final LeadService leadService;

    public CrmController(LeadService leadService) {
        this.leadService = leadService;
    }

    @GetMapping("/clients")
    public Page<LeadResponse> clients(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String sort,
            @RequestParam(required = false) String stage,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String owner,
            @RequestParam(required = false) String source,
            @RequestParam(required = false) String dateFrom,
            @RequestParam(required = false) String dateTo,
            @RequestParam(required = false) BigDecimal minValue,
            @RequestParam(required = false) BigDecimal maxValue) {
        return leadService.listScoped("clients", page, size, search, sort, stage, status, owner, source,
                dateFrom, dateTo, minValue, maxValue);
    }

    @GetMapping("/clients/next-number")
    public ResponseEntity<ApiResponse<ClientNextNumberResponse>> clientNextNumber() {
        return ResponseEntity.ok(ApiResponse.ok(leadService.getNextClientNumber()));
    }

    @GetMapping("/followups")
    public Page<LeadResponse> followUps(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String sort,
            @RequestParam(required = false) String stage,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String owner,
            @RequestParam(required = false) String source,
            @RequestParam(required = false) String dateFrom,
            @RequestParam(required = false) String dateTo,
            @RequestParam(required = false) BigDecimal minValue,
            @RequestParam(required = false) BigDecimal maxValue) {
        return leadService.listScoped("followups", page, size, search, sort, stage, status, owner, source,
                dateFrom, dateTo, minValue, maxValue);
    }

    @GetMapping("/contacts")
    public Page<LeadResponse> contacts(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String sort,
            @RequestParam(required = false) String stage,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String owner,
            @RequestParam(required = false) String source,
            @RequestParam(required = false) String dateFrom,
            @RequestParam(required = false) String dateTo,
            @RequestParam(required = false) BigDecimal minValue,
            @RequestParam(required = false) BigDecimal maxValue) {
        return leadService.listScoped("contacts", page, size, search, sort, stage, status, owner, source,
                dateFrom, dateTo, minValue, maxValue);
    }
}
