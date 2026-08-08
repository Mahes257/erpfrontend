package com.vishatech.erp.controller;

import com.vishatech.erp.dto.ActivityResponse;
import com.vishatech.erp.dto.ApiResponse;
import com.vishatech.erp.dto.AssignOwnerRequest;
import com.vishatech.erp.dto.AttachmentResponse;
import com.vishatech.erp.dto.BulkRequest;
import com.vishatech.erp.dto.ChangeStageRequest;
import com.vishatech.erp.dto.ExportRequest;
import com.vishatech.erp.dto.HistoryResponse;
import com.vishatech.erp.dto.LeadNextNumberResponse;
import com.vishatech.erp.dto.LeadRequest;
import com.vishatech.erp.dto.LeadResponse;
import com.vishatech.erp.dto.NoteRequest;
import com.vishatech.erp.dto.NoteResponse;
import com.vishatech.erp.dto.TimelineResponse;
import com.vishatech.erp.service.LeadService;
import jakarta.validation.Valid;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.List;
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
@RequestMapping("/leads")
public class LeadController {

    private final LeadService leadService;

    public LeadController(LeadService leadService) {
        this.leadService = leadService;
    }

    @GetMapping
    public Page<LeadResponse> list(
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
        return leadService.list(page, size, search, sort, stage, status, owner, source,
                dateFrom, dateTo, minValue, maxValue);
    }

    @PostMapping
    public ResponseEntity<ApiResponse<LeadResponse>> create(@Valid @RequestBody LeadRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(leadService.create(request)));
    }

    @GetMapping("/next-number")
    public ResponseEntity<ApiResponse<LeadNextNumberResponse>> nextNumber() {
        return ResponseEntity.ok(ApiResponse.ok(leadService.getNextNumber()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<LeadResponse>> get(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(leadService.get(id)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<LeadResponse>> update(@PathVariable Long id,
                                                           @Valid @RequestBody LeadRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(leadService.update(id, request)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        leadService.delete(id);
        return ResponseEntity.ok(ApiResponse.ok("Lead deleted"));
    }

    @PatchMapping("/archive/{id}")
    public ResponseEntity<ApiResponse<LeadResponse>> archive(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(leadService.archive(id)));
    }

    @PatchMapping("/restore/{id}")
    public ResponseEntity<ApiResponse<LeadResponse>> restore(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(leadService.restore(id)));
    }

    @PatchMapping("/inactive/{id}")
    public ResponseEntity<ApiResponse<LeadResponse>> markInactive(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(leadService.markInactive(id)));
    }

    @PatchMapping("/active/{id}")
    public ResponseEntity<ApiResponse<LeadResponse>> activate(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(leadService.activate(id)));
    }

    @PostMapping("/bulk-delete")
    public ResponseEntity<ApiResponse<Void>> bulkDelete(@Valid @RequestBody BulkRequest request) {
        int count = leadService.bulkDelete(request.ids());
        return ResponseEntity.ok(ApiResponse.ok("Deleted " + count + " lead(s)"));
    }

    @PostMapping("/bulk-archive")
    public ResponseEntity<ApiResponse<Void>> bulkArchive(@Valid @RequestBody BulkRequest request) {
        int count = leadService.bulkArchive(request.ids());
        return ResponseEntity.ok(ApiResponse.ok("Archived " + count + " lead(s)"));
    }

    @PostMapping("/bulk-restore")
    public ResponseEntity<ApiResponse<Void>> bulkRestore(@Valid @RequestBody BulkRequest request) {
        int count = leadService.bulkRestore(request.ids());
        return ResponseEntity.ok(ApiResponse.ok("Restored " + count + " lead(s)"));
    }

    @PatchMapping("/{id}/owner")
    public ResponseEntity<ApiResponse<LeadResponse>> assignOwner(@PathVariable Long id,
                                                                @Valid @RequestBody AssignOwnerRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(leadService.assignOwner(id, request.owner())));
    }

    @PatchMapping("/{id}/stage")
    public ResponseEntity<ApiResponse<LeadResponse>> changeStage(@PathVariable Long id,
                                                                @Valid @RequestBody ChangeStageRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(leadService.changeStage(id, request.stage())));
    }

    @PostMapping("/export")
    public ResponseEntity<?> export(@RequestBody(required = false) ExportRequest request) {
        String format = request != null && request.format() != null
                ? request.format().toLowerCase()
                : "csv";
        List<LeadResponse> leads = leadService.export(request);
        if ("csv".equals(format)) {
            byte[] bytes = leadService.buildCsv(leads).getBytes(StandardCharsets.UTF_8);
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"leads.csv\"")
                    .contentType(MediaType.parseMediaType("text/csv"))
                    .body(bytes);
        }
        return ResponseEntity.ok(leads);
    }

    @PostMapping("/import")
    public ResponseEntity<ApiResponse<Void>> importLeads(@RequestParam("file") MultipartFile file) {
        int count = leadService.importLeads(file);
        return ResponseEntity.ok(ApiResponse.ok("Imported " + count + " lead(s)"));
    }

    @PostMapping("/{id}/duplicate")
    public ResponseEntity<ApiResponse<LeadResponse>> duplicate(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(leadService.duplicate(id)));
    }

    @GetMapping("/{id}/timeline")
    public ResponseEntity<List<TimelineResponse>> timeline(@PathVariable Long id) {
        return ResponseEntity.ok(leadService.getTimeline(id));
    }

    @GetMapping("/{id}/activities")
    public ResponseEntity<List<ActivityResponse>> activities(@PathVariable Long id) {
        return ResponseEntity.ok(leadService.getActivities(id));
    }

    @GetMapping("/{id}/notes")
    public ResponseEntity<List<NoteResponse>> notes(@PathVariable Long id) {
        return ResponseEntity.ok(leadService.getNotes(id));
    }

    @PostMapping("/{id}/notes")
    public ResponseEntity<ApiResponse<NoteResponse>> addNote(@PathVariable Long id,
                                                            @Valid @RequestBody NoteRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(leadService.addNote(id, request.text())));
    }

    @GetMapping("/{id}/attachments")
    public ResponseEntity<List<AttachmentResponse>> attachments(@PathVariable Long id) {
        return ResponseEntity.ok(leadService.getAttachments(id));
    }

    @PostMapping("/{id}/attachments")
    public ResponseEntity<ApiResponse<AttachmentResponse>> addAttachment(@PathVariable Long id,
                                                                         @RequestParam("file") MultipartFile file) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(leadService.addAttachment(id, file)));
    }

    @GetMapping("/{id}/history")
    public ResponseEntity<List<HistoryResponse>> history(@PathVariable Long id) {
        return ResponseEntity.ok(leadService.getHistory(id));
    }
}
