package com.vishatech.erp.controller;

import com.vishatech.erp.dto.ApiResponse;
import com.vishatech.erp.dto.BulkRequest;
import com.vishatech.erp.dto.SalesAttachmentResponse;
import com.vishatech.erp.dto.SalesContractNextNumberResponse;
import com.vishatech.erp.dto.SalesContractRequest;
import com.vishatech.erp.dto.SalesContractResponse;
import com.vishatech.erp.dto.SalesHistoryResponse;
import com.vishatech.erp.dto.SalesTimelineResponse;
import com.vishatech.erp.dto.StatusRequest;
import com.vishatech.erp.service.SalesContractService;
import jakarta.validation.Valid;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/sales-contracts")
public class SalesContractController {

    private final SalesContractService salesContractService;

    public SalesContractController(SalesContractService salesContractService) {
        this.salesContractService = salesContractService;
    }

    @GetMapping
    public Page<SalesContractResponse> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String sort,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String client,
            @RequestParam(required = false) String salesExecutive,
            @RequestParam(required = false) String dateFrom,
            @RequestParam(required = false) String dateTo,
            @RequestParam(required = false) BigDecimal minAmount,
            @RequestParam(required = false) BigDecimal maxAmount) {
        return salesContractService.list(page, size, search, sort, status, client, salesExecutive,
                dateFrom, dateTo, minAmount, maxAmount);
    }

    @PostMapping
    public ResponseEntity<ApiResponse<SalesContractResponse>> create(@Valid @RequestBody SalesContractRequest request,
                                                                     @RequestParam(defaultValue = "false") boolean draft) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(salesContractService.create(request, draft)));
    }

    @GetMapping("/next-number")
    public ResponseEntity<ApiResponse<SalesContractNextNumberResponse>> nextNumber() {
        return ResponseEntity.ok(ApiResponse.ok(salesContractService.getNextNumber()));
    }

    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<Map<String, Object>>> stats() {
        return ResponseEntity.ok(ApiResponse.ok(salesContractService.stats()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<SalesContractResponse>> get(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(salesContractService.get(id)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<SalesContractResponse>> update(@PathVariable Long id,
                                                                     @Valid @RequestBody SalesContractRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(salesContractService.update(id, request)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        salesContractService.delete(id);
        return ResponseEntity.ok(ApiResponse.ok("Sales contract moved to trash"));
    }

    @PatchMapping("/archive/{id}")
    public ResponseEntity<ApiResponse<SalesContractResponse>> archive(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(salesContractService.archive(id)));
    }

    @PatchMapping("/restore/{id}")
    public ResponseEntity<ApiResponse<SalesContractResponse>> restore(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(salesContractService.restore(id)));
    }

    @PostMapping("/{id}/status")
    public ResponseEntity<ApiResponse<SalesContractResponse>> changeStatus(@PathVariable Long id,
                                                                           @RequestBody StatusRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(salesContractService.changeStatus(id, request.status())));
    }

    @PostMapping("/{id}/approve")
    public ResponseEntity<ApiResponse<SalesContractResponse>> approve(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(salesContractService.approve(id)));
    }

    @PostMapping("/{id}/convert-sales-order")
    public ResponseEntity<ApiResponse<SalesContractResponse>> convertToSalesOrder(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(salesContractService.convertToSalesOrder(id)));
    }

    @PostMapping("/{id}/duplicate")
    public ResponseEntity<ApiResponse<SalesContractResponse>> duplicate(@PathVariable Long id) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(salesContractService.duplicate(id)));
    }

    @PostMapping("/bulk-delete")
    public ResponseEntity<ApiResponse<Void>> bulkDelete(@Valid @RequestBody BulkRequest request) {
        int count = salesContractService.bulkDelete(request.ids());
        return ResponseEntity.ok(ApiResponse.ok("Deleted " + count + " sales contract(s)"));
    }

    @PostMapping("/bulk-archive")
    public ResponseEntity<ApiResponse<Void>> bulkArchive(@Valid @RequestBody BulkRequest request) {
        int count = salesContractService.bulkArchive(request.ids());
        return ResponseEntity.ok(ApiResponse.ok("Archived " + count + " sales contract(s)"));
    }

    @PostMapping("/bulk-restore")
    public ResponseEntity<ApiResponse<Void>> bulkRestore(@Valid @RequestBody BulkRequest request) {
        int count = salesContractService.bulkRestore(request.ids());
        return ResponseEntity.ok(ApiResponse.ok("Restored " + count + " sales contract(s)"));
    }

    @PostMapping("/export")
    public ResponseEntity<?> export(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String client,
            @RequestParam(required = false) String salesExecutive,
            @RequestParam(required = false) String dateFrom,
            @RequestParam(required = false) String dateTo,
            @RequestParam(required = false) BigDecimal minAmount,
            @RequestParam(required = false) BigDecimal maxAmount) {
        List<SalesContractResponse> contracts = salesContractService.export(search, status, client, salesExecutive,
                dateFrom, dateTo, minAmount, maxAmount);
        byte[] bytes = salesContractService.buildCsv(contracts).getBytes(StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"sales-contracts.csv\"")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(bytes);
    }

    @GetMapping("/{id}/timeline")
    public ResponseEntity<List<SalesTimelineResponse>> timeline(@PathVariable Long id) {
        return ResponseEntity.ok(salesContractService.getTimeline(id));
    }

    @GetMapping("/{id}/history")
    public ResponseEntity<List<SalesHistoryResponse>> history(@PathVariable Long id) {
        return ResponseEntity.ok(salesContractService.getHistory(id));
    }

    @GetMapping("/{id}/attachments")
    public ResponseEntity<List<SalesAttachmentResponse>> attachments(@PathVariable Long id) {
        return ResponseEntity.ok(salesContractService.getAttachments(id));
    }

    @PostMapping("/{id}/attachments")
    public ResponseEntity<ApiResponse<SalesAttachmentResponse>> addAttachment(@PathVariable Long id,
                                                                              @RequestParam("file") MultipartFile file) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(salesContractService.addAttachment(id, file)));
    }

    @DeleteMapping("/{id}/attachments/{attachmentId}")
    public ResponseEntity<ApiResponse<Void>> deleteAttachment(@PathVariable Long id,
                                                              @PathVariable Long attachmentId) {
        salesContractService.deleteAttachment(id, attachmentId);
        return ResponseEntity.ok(ApiResponse.ok("Attachment deleted"));
    }
}
