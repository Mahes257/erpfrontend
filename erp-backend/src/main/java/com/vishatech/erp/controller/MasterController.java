package com.vishatech.erp.controller;

import com.vishatech.erp.dto.ApiResponse;
import com.vishatech.erp.dto.MasterValueRequest;
import com.vishatech.erp.dto.MasterValueResponse;
import com.vishatech.erp.service.MasterValueService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * CRUD API for editable master dropdowns used by the CPR module:
 *   GET    /masters/{key}          -> list values
 *   POST   /masters/{key}          -> create (reuses existing on duplicate)
 *   PUT    /masters/{key}/{id}     -> rename
 *   DELETE /masters/{key}/{id}     -> delete (blocked while in use)
 */
@RestController
@RequestMapping("/masters")
public class MasterController {

    private final MasterValueService masterValueService;

    public MasterController(MasterValueService masterValueService) {
        this.masterValueService = masterValueService;
    }

    @GetMapping("/{key}")
    public ResponseEntity<ApiResponse<List<MasterValueResponse>>> list(@PathVariable String key) {
        return ResponseEntity.ok(ApiResponse.ok(masterValueService.list(key)));
    }

    @PostMapping("/{key}")
    public ResponseEntity<ApiResponse<MasterValueResponse>> create(@PathVariable String key,
                                                                   @Valid @RequestBody MasterValueRequest request) {
        MasterValueResponse created = masterValueService.create(key, request.value());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(created));
    }

    @PutMapping("/{key}/{id}")
    public ResponseEntity<ApiResponse<MasterValueResponse>> update(@PathVariable String key,
                                                                   @PathVariable Long id,
                                                                   @Valid @RequestBody MasterValueRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(masterValueService.update(key, id, request.value())));
    }

    @DeleteMapping("/{key}/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable String key, @PathVariable Long id) {
        masterValueService.delete(key, id);
        return ResponseEntity.ok(ApiResponse.ok("Master value deleted"));
    }
}
