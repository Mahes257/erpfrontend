package com.vishatech.erp.controller;

import com.vishatech.erp.dto.ApiResponse;
import com.vishatech.erp.dto.BulkRequest;
import com.vishatech.erp.dto.QuotationNextNumberResponse;
import com.vishatech.erp.dto.QuotationRequest;
import com.vishatech.erp.dto.QuotationResponse;
import com.vishatech.erp.dto.SalesAttachmentResponse;
import com.vishatech.erp.dto.SalesHistoryResponse;
import com.vishatech.erp.dto.SalesTimelineResponse;
import com.vishatech.erp.dto.StatusRequest;
import com.vishatech.erp.service.QuotationService;
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
@RequestMapping("/quotations")
public class QuotationController {

    private final QuotationService quotationService;

    public QuotationController(QuotationService quotationService) {
        this.quotationService = quotationService;
    }

    @GetMapping
    public Page<QuotationResponse> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String sort,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String client,
            @RequestParam(required = false) String salesPerson,
            @RequestParam(required = false) String dateFrom,
            @RequestParam(required = false) String dateTo,
            @RequestParam(required = false) String validTill,
            @RequestParam(required = false) BigDecimal minAmount,
            @RequestParam(required = false) BigDecimal maxAmount) {
        return quotationService.list(page, size, search, sort, status, client, salesPerson,
                dateFrom, dateTo, validTill, minAmount, maxAmount);
    }

    @PostMapping
    public ResponseEntity<ApiResponse<QuotationResponse>> create(@Valid @RequestBody QuotationRequest request,
                                                                 @RequestParam(defaultValue = "false") boolean draft) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(quotationService.create(request, draft)));
    }

    @GetMapping("/next-number")
    public ResponseEntity<ApiResponse<QuotationNextNumberResponse>> nextNumber() {
        return ResponseEntity.ok(ApiResponse.ok(quotationService.getNextNumber()));
    }

    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<Map<String, Object>>> stats() {
        return ResponseEntity.ok(ApiResponse.ok(quotationService.stats()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<QuotationResponse>> get(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(quotationService.get(id)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<QuotationResponse>> update(@PathVariable Long id,
                                                                 @Valid @RequestBody QuotationRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(quotationService.update(id, request)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        quotationService.delete(id);
        return ResponseEntity.ok(ApiResponse.ok("Quotation moved to trash"));
    }

    @PatchMapping("/archive/{id}")
    public ResponseEntity<ApiResponse<QuotationResponse>> archive(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(quotationService.archive(id)));
    }

    @PatchMapping("/restore/{id}")
    public ResponseEntity<ApiResponse<QuotationResponse>> restore(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(quotationService.restore(id)));
    }

    @PostMapping("/{id}/status")
    public ResponseEntity<ApiResponse<QuotationResponse>> changeStatus(@PathVariable Long id,
                                                                       @RequestBody StatusRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(quotationService.changeStatus(id, request.status(), request.remarks())));
    }

    @PostMapping("/{id}/send")
    public ResponseEntity<ApiResponse<QuotationResponse>> send(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(quotationService.send(id)));
    }

    @PostMapping("/{id}/convert-sales-order")
    public ResponseEntity<ApiResponse<QuotationResponse>> convertToSalesOrder(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(quotationService.convertToSalesOrder(id)));
    }

    @PostMapping("/{id}/convert-proforma")
    public ResponseEntity<ApiResponse<QuotationResponse>> convertToProforma(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(quotationService.convertToProforma(id)));
    }

    @PostMapping("/{id}/convert-invoice")
    public ResponseEntity<ApiResponse<QuotationResponse>> convertToInvoice(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(quotationService.convertToInvoice(id)));
    }

    @PostMapping("/{id}/convert-credit-note")
    public ResponseEntity<ApiResponse<QuotationResponse>> convertToCreditNote(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(quotationService.convertToCreditNote(id)));
    }

    @PostMapping("/{id}/convert-payment-receipt")
    public ResponseEntity<ApiResponse<QuotationResponse>> convertToPaymentReceipt(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(quotationService.convertToPaymentReceipt(id)));
    }

    @PostMapping("/{id}/convert-delivery-challan")
    public ResponseEntity<ApiResponse<QuotationResponse>> convertToDeliveryChallan(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(quotationService.convertToDeliveryChallan(id)));
    }

    @PostMapping("/{id}/duplicate")
    public ResponseEntity<ApiResponse<QuotationResponse>> duplicate(@PathVariable Long id) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(quotationService.duplicate(id)));
    }

    @PostMapping("/bulk-delete")
    public ResponseEntity<ApiResponse<Void>> bulkDelete(@Valid @RequestBody BulkRequest request) {
        int count = quotationService.bulkDelete(request.ids());
        return ResponseEntity.ok(ApiResponse.ok("Deleted " + count + " quotation(s)"));
    }

    @PostMapping("/bulk-archive")
    public ResponseEntity<ApiResponse<Void>> bulkArchive(@Valid @RequestBody BulkRequest request) {
        int count = quotationService.bulkArchive(request.ids());
        return ResponseEntity.ok(ApiResponse.ok("Archived " + count + " quotation(s)"));
    }

    @PostMapping("/bulk-restore")
    public ResponseEntity<ApiResponse<Void>> bulkRestore(@Valid @RequestBody BulkRequest request) {
        int count = quotationService.bulkRestore(request.ids());
        return ResponseEntity.ok(ApiResponse.ok("Restored " + count + " quotation(s)"));
    }

    @PostMapping("/export")
    public ResponseEntity<?> export(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String client,
            @RequestParam(required = false) String salesPerson,
            @RequestParam(required = false) String dateFrom,
            @RequestParam(required = false) String dateTo,
            @RequestParam(required = false) String validTill,
            @RequestParam(required = false) BigDecimal minAmount,
            @RequestParam(required = false) BigDecimal maxAmount) {
        List<QuotationResponse> quotations = quotationService.export(search, status, client, salesPerson,
                dateFrom, dateTo, validTill, minAmount, maxAmount);
        byte[] bytes = quotationService.buildCsv(quotations).getBytes(StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"quotations.csv\"")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(bytes);
    }

    @GetMapping("/{id}/timeline")
    public ResponseEntity<List<SalesTimelineResponse>> timeline(@PathVariable Long id) {
        return ResponseEntity.ok(quotationService.getTimeline(id));
    }

    @GetMapping("/{id}/history")
    public ResponseEntity<List<SalesHistoryResponse>> history(@PathVariable Long id) {
        return ResponseEntity.ok(quotationService.getHistory(id));
    }

    @GetMapping("/{id}/attachments")
    public ResponseEntity<List<SalesAttachmentResponse>> attachments(@PathVariable Long id) {
        return ResponseEntity.ok(quotationService.getAttachments(id));
    }

    @PostMapping("/{id}/attachments")
    public ResponseEntity<ApiResponse<SalesAttachmentResponse>> addAttachment(@PathVariable Long id,
                                                                              @RequestParam("file") MultipartFile file) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(quotationService.addAttachment(id, file)));
    }

    @DeleteMapping("/{id}/attachments/{attachmentId}")
    public ResponseEntity<ApiResponse<Void>> deleteAttachment(@PathVariable Long id,
                                                              @PathVariable Long attachmentId) {
        quotationService.deleteAttachment(id, attachmentId);
        return ResponseEntity.ok(ApiResponse.ok("Attachment deleted"));
    }
}
