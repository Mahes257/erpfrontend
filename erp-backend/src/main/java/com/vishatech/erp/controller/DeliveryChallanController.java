package com.vishatech.erp.controller;

import com.vishatech.erp.dto.ApiResponse;
import com.vishatech.erp.dto.BulkRequest;
import com.vishatech.erp.dto.DeliveryChallanNextNumberResponse;
import com.vishatech.erp.dto.DeliveryChallanRequest;
import com.vishatech.erp.dto.DeliveryChallanResponse;
import com.vishatech.erp.dto.SalesAttachmentResponse;
import com.vishatech.erp.dto.SalesHistoryResponse;
import com.vishatech.erp.dto.SalesTimelineResponse;
import com.vishatech.erp.dto.StatusRequest;
import com.vishatech.erp.service.DeliveryChallanService;
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
@RequestMapping("/delivery-challans")
public class DeliveryChallanController {

    private final DeliveryChallanService deliveryChallanService;

    public DeliveryChallanController(DeliveryChallanService deliveryChallanService) {
        this.deliveryChallanService = deliveryChallanService;
    }

    @GetMapping
    public Page<DeliveryChallanResponse> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String sort,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String client,
            @RequestParam(required = false) String soRef,
            @RequestParam(required = false) String dateFrom,
            @RequestParam(required = false) String dateTo,
            @RequestParam(required = false) BigDecimal minAmount,
            @RequestParam(required = false) BigDecimal maxAmount) {
        return deliveryChallanService.list(page, size, search, sort, status, client, soRef,
                dateFrom, dateTo, minAmount, maxAmount);
    }

    @PostMapping
    public ResponseEntity<ApiResponse<DeliveryChallanResponse>> create(@Valid @RequestBody DeliveryChallanRequest request,
                                                                       @RequestParam(defaultValue = "false") boolean draft) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(deliveryChallanService.create(request, draft)));
    }

    @GetMapping("/next-number")
    public ResponseEntity<ApiResponse<DeliveryChallanNextNumberResponse>> nextNumber() {
        return ResponseEntity.ok(ApiResponse.ok(deliveryChallanService.getNextNumber()));
    }

    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<Map<String, Object>>> stats() {
        return ResponseEntity.ok(ApiResponse.ok(deliveryChallanService.stats()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<DeliveryChallanResponse>> get(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(deliveryChallanService.get(id)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<DeliveryChallanResponse>> update(@PathVariable Long id,
                                                                       @Valid @RequestBody DeliveryChallanRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(deliveryChallanService.update(id, request)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        deliveryChallanService.delete(id);
        return ResponseEntity.ok(ApiResponse.ok("Delivery challan moved to trash"));
    }

    @PatchMapping("/archive/{id}")
    public ResponseEntity<ApiResponse<DeliveryChallanResponse>> archive(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(deliveryChallanService.archive(id)));
    }

    @PatchMapping("/restore/{id}")
    public ResponseEntity<ApiResponse<DeliveryChallanResponse>> restore(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(deliveryChallanService.restore(id)));
    }

    @PostMapping("/{id}/status")
    public ResponseEntity<ApiResponse<DeliveryChallanResponse>> changeStatus(@PathVariable Long id,
                                                                             @RequestBody StatusRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(deliveryChallanService.changeStatus(id, request.status())));
    }

    @PostMapping("/{id}/convert-invoice")
    public ResponseEntity<ApiResponse<DeliveryChallanResponse>> convertToInvoice(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(deliveryChallanService.convertToInvoice(id)));
    }

    @PostMapping("/{id}/duplicate")
    public ResponseEntity<ApiResponse<DeliveryChallanResponse>> duplicate(@PathVariable Long id) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(deliveryChallanService.duplicate(id)));
    }

    @PostMapping("/bulk-delete")
    public ResponseEntity<ApiResponse<Void>> bulkDelete(@Valid @RequestBody BulkRequest request) {
        int count = deliveryChallanService.bulkDelete(request.ids());
        return ResponseEntity.ok(ApiResponse.ok("Deleted " + count + " delivery challan(s)"));
    }

    @PostMapping("/bulk-archive")
    public ResponseEntity<ApiResponse<Void>> bulkArchive(@Valid @RequestBody BulkRequest request) {
        int count = deliveryChallanService.bulkArchive(request.ids());
        return ResponseEntity.ok(ApiResponse.ok("Archived " + count + " delivery challan(s)"));
    }

    @PostMapping("/bulk-restore")
    public ResponseEntity<ApiResponse<Void>> bulkRestore(@Valid @RequestBody BulkRequest request) {
        int count = deliveryChallanService.bulkRestore(request.ids());
        return ResponseEntity.ok(ApiResponse.ok("Restored " + count + " delivery challan(s)"));
    }

    @PostMapping("/export")
    public ResponseEntity<?> export(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String client,
            @RequestParam(required = false) String soRef,
            @RequestParam(required = false) String dateFrom,
            @RequestParam(required = false) String dateTo,
            @RequestParam(required = false) BigDecimal minAmount,
            @RequestParam(required = false) BigDecimal maxAmount) {
        List<DeliveryChallanResponse> dcs = deliveryChallanService.export(search, status, client, soRef,
                dateFrom, dateTo, minAmount, maxAmount);
        byte[] bytes = deliveryChallanService.buildCsv(dcs).getBytes(StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"delivery-challans.csv\"")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(bytes);
    }

    @GetMapping("/{id}/timeline")
    public ResponseEntity<List<SalesTimelineResponse>> timeline(@PathVariable Long id) {
        return ResponseEntity.ok(deliveryChallanService.getTimeline(id));
    }

    @GetMapping("/{id}/history")
    public ResponseEntity<List<SalesHistoryResponse>> history(@PathVariable Long id) {
        return ResponseEntity.ok(deliveryChallanService.getHistory(id));
    }

    @GetMapping("/{id}/attachments")
    public ResponseEntity<List<SalesAttachmentResponse>> attachments(@PathVariable Long id) {
        return ResponseEntity.ok(deliveryChallanService.getAttachments(id));
    }

    @PostMapping("/{id}/attachments")
    public ResponseEntity<ApiResponse<SalesAttachmentResponse>> addAttachment(@PathVariable Long id,
                                                                              @RequestParam("file") MultipartFile file) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(deliveryChallanService.addAttachment(id, file)));
    }

    @DeleteMapping("/{id}/attachments/{attachmentId}")
    public ResponseEntity<ApiResponse<Void>> deleteAttachment(@PathVariable Long id,
                                                              @PathVariable Long attachmentId) {
        deliveryChallanService.deleteAttachment(id, attachmentId);
        return ResponseEntity.ok(ApiResponse.ok("Attachment deleted"));
    }
}
