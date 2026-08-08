package com.vishatech.erp.controller;

import com.vishatech.erp.dto.ApiResponse;
import com.vishatech.erp.dto.BulkRequest;
import com.vishatech.erp.dto.SalesAttachmentResponse;
import com.vishatech.erp.dto.SalesHistoryResponse;
import com.vishatech.erp.dto.SalesOrderNextNumberResponse;
import com.vishatech.erp.dto.SalesOrderRequest;
import com.vishatech.erp.dto.SalesOrderResponse;
import com.vishatech.erp.dto.SalesTimelineResponse;
import com.vishatech.erp.dto.StatusRequest;
import com.vishatech.erp.service.SalesOrderService;
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
@RequestMapping("/sales-orders")
public class SalesOrderController {

    private final SalesOrderService salesOrderService;

    public SalesOrderController(SalesOrderService salesOrderService) {
        this.salesOrderService = salesOrderService;
    }

    @GetMapping
    public Page<SalesOrderResponse> list(
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
        return salesOrderService.list(page, size, search, sort, status, client, salesExecutive,
                dateFrom, dateTo, minAmount, maxAmount);
    }

    @PostMapping
    public ResponseEntity<ApiResponse<SalesOrderResponse>> create(@Valid @RequestBody SalesOrderRequest request,
                                                                  @RequestParam(defaultValue = "false") boolean draft) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(salesOrderService.create(request, draft)));
    }

    @GetMapping("/next-number")
    public ResponseEntity<ApiResponse<SalesOrderNextNumberResponse>> nextNumber() {
        return ResponseEntity.ok(ApiResponse.ok(salesOrderService.getNextNumber()));
    }

    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<Map<String, Object>>> stats() {
        return ResponseEntity.ok(ApiResponse.ok(salesOrderService.stats()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<SalesOrderResponse>> get(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(salesOrderService.get(id)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<SalesOrderResponse>> update(@PathVariable Long id,
                                                                  @Valid @RequestBody SalesOrderRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(salesOrderService.update(id, request)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        salesOrderService.delete(id);
        return ResponseEntity.ok(ApiResponse.ok("Sales order moved to trash"));
    }

    @PatchMapping("/archive/{id}")
    public ResponseEntity<ApiResponse<SalesOrderResponse>> archive(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(salesOrderService.archive(id)));
    }

    @PatchMapping("/restore/{id}")
    public ResponseEntity<ApiResponse<SalesOrderResponse>> restore(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(salesOrderService.restore(id)));
    }

    @PostMapping("/{id}/status")
    public ResponseEntity<ApiResponse<SalesOrderResponse>> changeStatus(@PathVariable Long id,
                                                                       @RequestBody StatusRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(salesOrderService.changeStatus(id, request.status())));
    }

    @PostMapping("/{id}/approve")
    public ResponseEntity<ApiResponse<SalesOrderResponse>> approve(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(salesOrderService.approve(id)));
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<ApiResponse<SalesOrderResponse>> cancel(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(salesOrderService.cancel(id)));
    }

    @PostMapping("/{id}/generate-delivery-challan")
    public ResponseEntity<ApiResponse<SalesOrderResponse>> generateDeliveryChallan(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(salesOrderService.generateDeliveryChallan(id)));
    }

    @PostMapping("/{id}/convert-proforma")
    public ResponseEntity<ApiResponse<SalesOrderResponse>> convertToProforma(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(salesOrderService.convertToProforma(id)));
    }

    @PostMapping("/{id}/convert-invoice")
    public ResponseEntity<ApiResponse<SalesOrderResponse>> convertToInvoice(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(salesOrderService.convertToInvoice(id)));
    }

    @PostMapping("/{id}/duplicate")
    public ResponseEntity<ApiResponse<SalesOrderResponse>> duplicate(@PathVariable Long id) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(salesOrderService.duplicate(id)));
    }

    @PostMapping("/bulk-delete")
    public ResponseEntity<ApiResponse<Void>> bulkDelete(@Valid @RequestBody BulkRequest request) {
        int count = salesOrderService.bulkDelete(request.ids());
        return ResponseEntity.ok(ApiResponse.ok("Deleted " + count + " sales order(s)"));
    }

    @PostMapping("/bulk-archive")
    public ResponseEntity<ApiResponse<Void>> bulkArchive(@Valid @RequestBody BulkRequest request) {
        int count = salesOrderService.bulkArchive(request.ids());
        return ResponseEntity.ok(ApiResponse.ok("Archived " + count + " sales order(s)"));
    }

    @PostMapping("/bulk-restore")
    public ResponseEntity<ApiResponse<Void>> bulkRestore(@Valid @RequestBody BulkRequest request) {
        int count = salesOrderService.bulkRestore(request.ids());
        return ResponseEntity.ok(ApiResponse.ok("Restored " + count + " sales order(s)"));
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
        List<SalesOrderResponse> orders = salesOrderService.export(search, status, client, salesExecutive,
                dateFrom, dateTo, minAmount, maxAmount);
        byte[] bytes = salesOrderService.buildCsv(orders).getBytes(StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"sales-orders.csv\"")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(bytes);
    }

    @GetMapping("/{id}/timeline")
    public ResponseEntity<List<SalesTimelineResponse>> timeline(@PathVariable Long id) {
        return ResponseEntity.ok(salesOrderService.getTimeline(id));
    }

    @GetMapping("/{id}/history")
    public ResponseEntity<List<SalesHistoryResponse>> history(@PathVariable Long id) {
        return ResponseEntity.ok(salesOrderService.getHistory(id));
    }

    @GetMapping("/{id}/attachments")
    public ResponseEntity<List<SalesAttachmentResponse>> attachments(@PathVariable Long id) {
        return ResponseEntity.ok(salesOrderService.getAttachments(id));
    }

    @PostMapping("/{id}/attachments")
    public ResponseEntity<ApiResponse<SalesAttachmentResponse>> addAttachment(@PathVariable Long id,
                                                                              @RequestParam("file") MultipartFile file) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(salesOrderService.addAttachment(id, file)));
    }

    @DeleteMapping("/{id}/attachments/{attachmentId}")
    public ResponseEntity<ApiResponse<Void>> deleteAttachment(@PathVariable Long id,
                                                              @PathVariable Long attachmentId) {
        salesOrderService.deleteAttachment(id, attachmentId);
        return ResponseEntity.ok(ApiResponse.ok("Attachment deleted"));
    }
}
