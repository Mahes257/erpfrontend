package com.vishatech.erp.controller;

import com.vishatech.erp.dto.ApiResponse;
import com.vishatech.erp.dto.CostWorkoutAttachment;
import com.vishatech.erp.dto.CostWorkoutItemResponse;
import com.vishatech.erp.dto.CostWorkoutNextNumberResponse;
import com.vishatech.erp.dto.CostWorkoutRequest;
import com.vishatech.erp.dto.CostWorkoutResponse;
import com.vishatech.erp.dto.CostWorkoutTimelineResponse;
import com.vishatech.erp.service.CostWorkoutService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/cost-workouts")
public class CostWorkoutController {

    private final CostWorkoutService costWorkoutService;

    public CostWorkoutController(CostWorkoutService costWorkoutService) {
        this.costWorkoutService = costWorkoutService;
    }

    @GetMapping
    public Page<CostWorkoutResponse> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String sort,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String cprRef,
            @RequestParam(required = false) String customer,
            @RequestParam(required = false) String company,
            @RequestParam(required = false) String preparedBy,
            @RequestParam(required = false) String dateFrom,
            @RequestParam(required = false) String dateTo) {
        return costWorkoutService.list(page, size, search, sort, status, cprRef, customer,
                company, preparedBy, dateFrom, dateTo);
    }

    @PostMapping
    public ResponseEntity<ApiResponse<CostWorkoutResponse>> create(@Valid @RequestBody CostWorkoutRequest request,
                                                                   @RequestParam(defaultValue = "false") boolean draft) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(costWorkoutService.create(request, draft)));
    }

    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<Map<String, Object>>> stats() {
        return ResponseEntity.ok(ApiResponse.ok(costWorkoutService.stats()));
    }

    @GetMapping("/dashboard")
    public ResponseEntity<ApiResponse<Map<String, Object>>> dashboard() {
        return ResponseEntity.ok(ApiResponse.ok(costWorkoutService.stats()));
    }

    @GetMapping("/next-number")
    public ResponseEntity<ApiResponse<CostWorkoutNextNumberResponse>> nextNumber() {
        return ResponseEntity.ok(ApiResponse.ok(costWorkoutService.getNextNumber()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<CostWorkoutResponse>> get(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(costWorkoutService.get(id)));
    }

    @GetMapping("/{id}/items")
    public ResponseEntity<List<CostWorkoutItemResponse>> items(@PathVariable Long id) {
        return ResponseEntity.ok(costWorkoutService.getItems(id));
    }

    @GetMapping("/{id}/timeline")
    public ResponseEntity<List<CostWorkoutTimelineResponse>> timeline(@PathVariable Long id) {
        return ResponseEntity.ok(costWorkoutService.getTimeline(id));
    }

    @GetMapping("/{id}/attachments")
    public ResponseEntity<List<CostWorkoutAttachment>> attachments(@PathVariable Long id) {
        return ResponseEntity.ok(costWorkoutService.getAttachments(id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<CostWorkoutResponse>> update(@PathVariable Long id,
                                                                   @Valid @RequestBody CostWorkoutRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(costWorkoutService.update(id, request)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        costWorkoutService.delete(id);
        return ResponseEntity.ok(ApiResponse.ok("Cost Workout moved to trash"));
    }

    @DeleteMapping("/{id}/permanent")
    public ResponseEntity<ApiResponse<Void>> permanentDelete(@PathVariable Long id) {
        costWorkoutService.permanentDelete(id);
        return ResponseEntity.ok(ApiResponse.ok("Cost Workout permanently deleted"));
    }

    @PostMapping("/{id}/restore")
    public ResponseEntity<ApiResponse<CostWorkoutResponse>> restore(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(costWorkoutService.restore(id)));
    }

    @PostMapping("/{id}/archive")
    public ResponseEntity<ApiResponse<CostWorkoutResponse>> archive(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(costWorkoutService.archive(id)));
    }

    @PostMapping("/{id}/submit")
    public ResponseEntity<ApiResponse<CostWorkoutResponse>> submit(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(costWorkoutService.submit(id)));
    }

    @PostMapping("/{id}/approve")
    public ResponseEntity<ApiResponse<CostWorkoutResponse>> approve(@PathVariable Long id,
                                                                    @RequestBody(required = false) Map<String, String> body) {
        String remarks = body == null ? null : body.get("remarks");
        return ResponseEntity.ok(ApiResponse.ok(costWorkoutService.approve(id, remarks)));
    }

    @PostMapping("/{id}/reject")
    public ResponseEntity<ApiResponse<CostWorkoutResponse>> reject(@PathVariable Long id,
                                                                   @RequestBody(required = false) Map<String, String> body) {
        String remarks = body == null ? null : body.get("remarks");
        return ResponseEntity.ok(ApiResponse.ok(costWorkoutService.reject(id, remarks)));
    }

    @PostMapping("/{id}/duplicate")
    public ResponseEntity<ApiResponse<CostWorkoutResponse>> duplicate(@PathVariable Long id) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(costWorkoutService.duplicate(id)));
    }

    @GetMapping("/custom-categories")
    public ResponseEntity<ApiResponse<List<String>>> customCategories() {
        return ResponseEntity.ok(ApiResponse.ok(costWorkoutService.getCustomCategories()));
    }

    @PostMapping("/custom-categories")
    public ResponseEntity<ApiResponse<Void>> saveCustomCategories(@RequestBody Map<String, List<String>> body) {
        costWorkoutService.saveCustomCategories(body == null ? List.of() : body.get("categories"));
        return ResponseEntity.ok(ApiResponse.ok("Custom categories saved"));
    }

    @GetMapping("/custom-units")
    public ResponseEntity<ApiResponse<List<String>>> customUnits() {
        return ResponseEntity.ok(ApiResponse.ok(costWorkoutService.getCustomUnits()));
    }

    @PostMapping("/custom-units")
    public ResponseEntity<ApiResponse<Void>> saveCustomUnits(@RequestBody Map<String, List<String>> body) {
        costWorkoutService.saveCustomUnits(body == null ? List.of() : body.get("units"));
        return ResponseEntity.ok(ApiResponse.ok("Custom units saved"));
    }
}
