package com.vishatech.erp.controller;

import com.vishatech.erp.dto.ApiResponse;
import com.vishatech.erp.dto.BulkRequest;
import com.vishatech.erp.dto.CprActionRequest;
import com.vishatech.erp.dto.CprAttachmentResponse;
import com.vishatech.erp.dto.CprCommentRequest;
import com.vishatech.erp.dto.CprCommentResponse;
import com.vishatech.erp.dto.CprHistoryResponse;
import com.vishatech.erp.dto.CprNextNumberResponse;
import com.vishatech.erp.dto.CprRequest;
import com.vishatech.erp.dto.CprResponse;
import com.vishatech.erp.dto.CprTimelineResponse;
import com.vishatech.erp.service.CprService;
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
@RequestMapping("/cprs")
public class CprController {

    private final CprService cprService;

    public CprController(CprService cprService) {
        this.cprService = cprService;
    }

    @GetMapping
    public Page<CprResponse> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String sort,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String approval,
            @RequestParam(required = false) String department,
            @RequestParam(required = false) String dateFrom,
            @RequestParam(required = false) String dateTo,
            @RequestParam(required = false) BigDecimal minValue,
            @RequestParam(required = false) BigDecimal maxValue) {
        return cprService.list(page, size, search, sort, status, approval, department,
                dateFrom, dateTo, minValue, maxValue);
    }

    @PostMapping
    public ResponseEntity<ApiResponse<CprResponse>> create(@Valid @RequestBody CprRequest request,
                                                           @RequestParam(defaultValue = "false") boolean draft) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(cprService.create(request, draft)));
    }

    @GetMapping("/next-number")
    public ResponseEntity<ApiResponse<CprNextNumberResponse>> nextNumber() {
        return ResponseEntity.ok(ApiResponse.ok(cprService.getNextNumber()));
    }

    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<Map<String, Object>>> stats() {
        return ResponseEntity.ok(ApiResponse.ok(cprService.stats()));
    }

    @GetMapping("/reports/summary")
    public ResponseEntity<ApiResponse<Map<String, Object>>> reportsSummary() {
        return ResponseEntity.ok(ApiResponse.ok(cprService.reportsSummary()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<CprResponse>> get(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(cprService.get(id)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<CprResponse>> update(@PathVariable Long id,
                                                           @Valid @RequestBody CprRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(cprService.update(id, request)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        cprService.delete(id);
        return ResponseEntity.ok(ApiResponse.ok("CPR moved to trash"));
    }

    @PatchMapping("/archive/{id}")
    public ResponseEntity<ApiResponse<CprResponse>> archive(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(cprService.archive(id)));
    }

    @PatchMapping("/restore/{id}")
    public ResponseEntity<ApiResponse<CprResponse>> restore(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(cprService.restore(id)));
    }

    @PostMapping("/{id}/submit")
    public ResponseEntity<ApiResponse<CprResponse>> submit(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(cprService.submit(id)));
    }

    @PostMapping("/{id}/approve")
    public ResponseEntity<ApiResponse<CprResponse>> approve(@PathVariable Long id,
                                                            @RequestBody(required = false) CprActionRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(cprService.approve(id, request == null ? null : request.remarks())));
    }

    @PostMapping("/{id}/reject")
    public ResponseEntity<ApiResponse<CprResponse>> reject(@PathVariable Long id,
                                                           @RequestBody(required = false) CprActionRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(cprService.reject(id, request == null ? null : request.remarks())));
    }

    @PostMapping("/{id}/send-back")
    public ResponseEntity<ApiResponse<CprResponse>> sendBack(@PathVariable Long id,
                                                             @RequestBody(required = false) CprActionRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(cprService.sendBack(id, request == null ? null : request.remarks())));
    }

    @PostMapping("/{id}/convert-quotation")
    public ResponseEntity<ApiResponse<CprResponse>> convertToQuotation(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(cprService.convertToQuotation(id)));
    }

    @PostMapping("/{id}/duplicate")
    public ResponseEntity<ApiResponse<CprResponse>> duplicate(@PathVariable Long id) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(cprService.duplicate(id)));
    }

    @PostMapping("/bulk-delete")
    public ResponseEntity<ApiResponse<Void>> bulkDelete(@Valid @RequestBody BulkRequest request) {
        int count = cprService.bulkDelete(request.ids());
        return ResponseEntity.ok(ApiResponse.ok("Deleted " + count + " CPR(s)"));
    }

    @PostMapping("/bulk-archive")
    public ResponseEntity<ApiResponse<Void>> bulkArchive(@Valid @RequestBody BulkRequest request) {
        int count = cprService.bulkArchive(request.ids());
        return ResponseEntity.ok(ApiResponse.ok("Archived " + count + " CPR(s)"));
    }

    @PostMapping("/bulk-restore")
    public ResponseEntity<ApiResponse<Void>> bulkRestore(@Valid @RequestBody BulkRequest request) {
        int count = cprService.bulkRestore(request.ids());
        return ResponseEntity.ok(ApiResponse.ok("Restored " + count + " CPR(s)"));
    }

    @PostMapping("/bulk-permanent-delete")
    public ResponseEntity<ApiResponse<Void>> bulkPermanentDelete(@Valid @RequestBody BulkRequest request) {
        int count = cprService.bulkPermanentDelete(request.ids());
        return ResponseEntity.ok(ApiResponse.ok("Permanently deleted " + count + " CPR(s)"));
    }

    @PostMapping("/export")
    public ResponseEntity<?> export(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String approval,
            @RequestParam(required = false) String department,
            @RequestParam(required = false) String dateFrom,
            @RequestParam(required = false) String dateTo,
            @RequestParam(required = false) BigDecimal minValue,
            @RequestParam(required = false) BigDecimal maxValue) {
        List<CprResponse> cprs = cprService.export(search, status, approval, department,
                dateFrom, dateTo, minValue, maxValue);
        byte[] bytes = cprService.buildCsv(cprs).getBytes(StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"cprs.csv\"")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(bytes);
    }

    @GetMapping("/{id}/timeline")
    public ResponseEntity<List<CprTimelineResponse>> timeline(@PathVariable Long id) {
        return ResponseEntity.ok(cprService.getTimeline(id));
    }

    @GetMapping("/{id}/history")
    public ResponseEntity<List<CprHistoryResponse>> history(@PathVariable Long id) {
        return ResponseEntity.ok(cprService.getHistory(id));
    }

    @GetMapping("/{id}/attachments")
    public ResponseEntity<List<CprAttachmentResponse>> attachments(@PathVariable Long id) {
        return ResponseEntity.ok(cprService.getAttachments(id));
    }

    @PostMapping("/{id}/attachments")
    public ResponseEntity<ApiResponse<CprAttachmentResponse>> addAttachment(@PathVariable Long id,
                                                                            @RequestParam("file") MultipartFile file) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(cprService.addAttachment(id, file)));
    }

    @DeleteMapping("/{id}/attachments/{attachmentId}")
    public ResponseEntity<ApiResponse<Void>> deleteAttachment(@PathVariable Long id,
                                                              @PathVariable Long attachmentId) {
        cprService.deleteAttachment(id, attachmentId);
        return ResponseEntity.ok(ApiResponse.ok("Attachment deleted"));
    }

    @GetMapping("/{id}/comments")
    public ResponseEntity<List<CprCommentResponse>> comments(@PathVariable Long id) {
        return ResponseEntity.ok(cprService.getComments(id));
    }

    @PostMapping("/{id}/comments")
    public ResponseEntity<ApiResponse<CprCommentResponse>> addComment(@PathVariable Long id,
                                                                      @Valid @RequestBody CprCommentRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(cprService.addComment(id, request.text())));
    }

    @PutMapping("/{id}/comments/{commentId}")
    public ResponseEntity<ApiResponse<CprCommentResponse>> updateComment(@PathVariable Long id,
                                                                         @PathVariable Long commentId,
                                                                         @Valid @RequestBody CprCommentRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(cprService.updateComment(id, commentId, request.text())));
    }

    @DeleteMapping("/{id}/comments/{commentId}")
    public ResponseEntity<ApiResponse<Void>> deleteComment(@PathVariable Long id,
                                                           @PathVariable Long commentId) {
        cprService.deleteComment(id, commentId);
        return ResponseEntity.ok(ApiResponse.ok("Comment deleted"));
    }
}
