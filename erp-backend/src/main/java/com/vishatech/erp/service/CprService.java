package com.vishatech.erp.service;

import com.vishatech.erp.dto.CprActionRequest;
import com.vishatech.erp.dto.CprAttachmentResponse;
import com.vishatech.erp.dto.CprCommentResponse;
import com.vishatech.erp.dto.CprHistoryResponse;
import com.vishatech.erp.dto.CprItemRequest;
import com.vishatech.erp.dto.CprItemResponse;
import com.vishatech.erp.dto.CprNextNumberResponse;
import com.vishatech.erp.dto.CprRequest;
import com.vishatech.erp.dto.CprResponse;
import com.vishatech.erp.dto.CprTimelineResponse;
import com.vishatech.erp.entity.Cpr;
import com.vishatech.erp.entity.CprApprovalStatus;
import com.vishatech.erp.entity.CprAttachment;
import com.vishatech.erp.entity.CprComment;
import com.vishatech.erp.entity.CprHistory;
import com.vishatech.erp.entity.CprItem;
import com.vishatech.erp.entity.CprStatus;
import com.vishatech.erp.entity.CprTimeline;
import com.vishatech.erp.exception.BadRequestException;
import com.vishatech.erp.exception.ResourceNotFoundException;
import com.vishatech.erp.entity.CostWorkout;
import com.vishatech.erp.entity.CostWorkoutCategory;
import com.vishatech.erp.repository.CostWorkoutRepository;
import com.vishatech.erp.repository.CprRepository;
import com.vishatech.erp.util.AuditContext;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.criteria.Predicate;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Year;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
@Transactional
public class CprService {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    private final CprRepository cprRepository;
    private final FileStorageService fileStorageService;
    private final QuotationService quotationService;
    private final CostWorkoutRepository costWorkoutRepository;
    private final AuditContext auditContext;
    private final String baseUrl;

    @PersistenceContext
    private EntityManager entityManager;

    public CprService(CprRepository cprRepository, FileStorageService fileStorageService,
                      QuotationService quotationService,
                      CostWorkoutRepository costWorkoutRepository,
                      AuditContext auditContext,
                      @Value("${app.base-url:http://localhost:8080}") String baseUrl) {
        this.cprRepository = cprRepository;
        this.fileStorageService = fileStorageService;
        this.quotationService = quotationService;
        this.costWorkoutRepository = costWorkoutRepository;
        this.auditContext = auditContext;
        this.baseUrl = baseUrl;
    }

    // ============================== Read ==============================

    @Transactional
    public Page<CprResponse> list(int page, int size, String search, String sort,
                                  String status, String approval, String department,
                                  String dateFrom, String dateTo, BigDecimal minValue, BigDecimal maxValue) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(size, 1), 200);
        Pageable pageable = PageRequest.of(safePage, safeSize, buildSort(sort));
        Specification<Cpr> spec = buildSpecification(search, status, approval, department, dateFrom, dateTo, minValue, maxValue);
        return cprRepository.findAll(spec, pageable).map(this::toResponse);
    }

    @Transactional
    public CprResponse get(Long id) {
        return toResponse(getCpr(id));
    }

    public CprNextNumberResponse getNextNumber() {
        long next = nextSequence();
        return new CprNextNumberResponse(buildPrNo(next), next);
    }

    @Transactional
    public Map<String, Object> stats() {
        long draft = cprRepository.countByStatus(CprStatus.DRAFT);
        long costWorkout = cprRepository.countByStatus(CprStatus.COST_WORKOUT);
        long pendingApproval = cprRepository.countByStatus(CprStatus.PENDING_APPROVAL);
        long approved = cprRepository.countByStatus(CprStatus.APPROVED);
        long converted = cprRepository.countByStatus(CprStatus.CONVERTED);
        long rejected = cprRepository.countByStatus(CprStatus.REJECTED);
        long archived = cprRepository.countByStatus(CprStatus.ARCHIVED);
        long deleted = cprRepository.countByStatus(CprStatus.DELETED);
        long active = draft + costWorkout + pendingApproval + approved + converted + rejected;
        BigDecimal totalAmt = cprRepository.sumGrandTotalExcluding(
                List.of(CprStatus.ARCHIVED, CprStatus.DELETED));

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("total", active);
        stats.put("active", active);
        stats.put("draft", draft);
        stats.put("costWorkout", costWorkout);
        stats.put("pendingApproval", pendingApproval);
        stats.put("approved", approved);
        stats.put("converted", converted);
        stats.put("rejected", rejected);
        stats.put("archived", archived);
        stats.put("deleted", deleted);
        stats.put("totalAmt", totalAmt);
        return stats;
    }

    // ============================== Write ==============================

    public CprResponse create(CprRequest request, boolean draft) {
        Cpr cpr = new Cpr();
        if (request.prNo() != null && !request.prNo().isBlank()) {
            cpr.setPrNo(request.prNo().trim());
        } else {
            cpr.setPrNo(buildPrNo(nextSequence()));
        }
        // Mirror the create-form item requirement for non-draft saves; draft
        // saves stay lenient so a blank draft can be saved.
        if (!draft && (request.items() == null || request.items().isEmpty())) {
            throw new BadRequestException("At least one item is required");
        }
        applyRequest(cpr, request);
        if (draft) {
            cpr.setStatus(CprStatus.DRAFT);
        } else if (request.status() != null && !request.status().isBlank()) {
            cpr.setStatus(parseStatus(request.status()));
        } else {
            cpr.setStatus(CprStatus.DRAFT);
        }
        cpr.setApprovalStatus(cpr.getStatus() == CprStatus.APPROVED
                ? CprApprovalStatus.APPROVED
                : CprApprovalStatus.PENDING);
        syncStage(cpr);
        recalcTotals(cpr);
        cpr.addTimeline(entry("created", "CPR created",
                "CPR '" + cpr.getPrNo() + "' was created."));
        cpr.addHistory(history("CPR", null, cpr.getPrNo(), currentUserName()));
        return toResponse(cprRepository.save(cpr));
    }

    public CprResponse update(Long id, CprRequest request) {
        Cpr cpr = getCpr(id);
        Map<String, String> before = snapshotFields(cpr);
        applyRequest(cpr, request);
        if (request.status() != null && !request.status().isBlank()) {
            cpr.setStatus(parseStatus(request.status()));
        }
        if (request.approvalStatus() != null && !request.approvalStatus().isBlank()) {
            cpr.setApprovalStatus(parseApprovalStatus(request.approvalStatus()));
        }
        syncStage(cpr);
        recalcTotals(cpr);
        List<CprTimeline> fieldChanges = changedFields(before, cpr);
        boolean draftSave = cpr.getStatus() == CprStatus.DRAFT;
        // A summary row is always inserted per save (draft saves get a dedicated
        // event type) plus one row per changed field.
        cpr.addTimeline(entry(draftSave ? "draft saved" : "updated",
                draftSave ? "Draft saved" : "CPR updated",
                (draftSave ? "Draft of CPR " : "CPR details ") + "were updated by " + currentUserName() + "."));
        fieldChanges.forEach(cpr::addTimeline);
        return toResponse(cprRepository.save(cpr));
    }

    public CprResponse delete(Long id) {
        Cpr cpr = getCpr(id);
        CprStatus previous = cpr.getStatus();
        cpr.setStatus(CprStatus.DELETED);
        cpr.setArchivedAt(LocalDateTime.now());
        cpr.addTimeline(fieldEntry("deleted", "CPR deleted", "CPR was moved to trash by " + currentUserName() + ".",
                "Status", label(previous), "Deleted"));
        cpr.addHistory(history("Status", label(previous), "Deleted", currentUserName()));
        return toResponse(cprRepository.save(cpr));
    }

    public CprResponse restore(Long id) {
        Cpr cpr = getCpr(id);
        CprStatus previous = cpr.getStatus();
        CprStatus target = previous == CprStatus.DELETED || previous == CprStatus.ARCHIVED
                ? CprStatus.DRAFT : previous;
        cpr.setStatus(target);
        cpr.setArchivedAt(null);
        cpr.addTimeline(fieldEntry("restored", "CPR restored", "CPR was restored by " + currentUserName() + ".",
                "Status", label(previous), label(target)));
        cpr.addHistory(history("Status", label(previous), label(target), currentUserName()));
        syncStage(cpr);
        return toResponse(cprRepository.save(cpr));
    }

    public CprResponse archive(Long id) {
        Cpr cpr = getCpr(id);
        CprStatus previous = cpr.getStatus();
        cpr.setStatus(CprStatus.ARCHIVED);
        cpr.setArchivedAt(LocalDateTime.now());
        cpr.addTimeline(fieldEntry("archived", "CPR archived", "CPR was archived by " + currentUserName() + ".",
                "Status", label(previous), "Archived"));
        cpr.addHistory(history("Status", label(previous), "Archived", currentUserName()));
        syncStage(cpr);
        return toResponse(cprRepository.save(cpr));
    }

    public CprResponse submit(Long id) {
        Cpr cpr = getCpr(id);
        if (cpr.getStatus() == CprStatus.PENDING_APPROVAL || cpr.getStatus() == CprStatus.APPROVED
                || cpr.getStatus() == CprStatus.CONVERTED) {
            throw new BadRequestException("CPR is already in status '" + label(cpr.getStatus()) + "' and cannot be submitted");
        }
        CprStatus previous = cpr.getStatus();
        cpr.setStatus(CprStatus.PENDING_APPROVAL);
        cpr.setApprovalStatus(CprApprovalStatus.PENDING);
        cpr.setSubmittedBy(currentUserName());
        cpr.setSubmittedAt(LocalDateTime.now());
        cpr.addTimeline(fieldEntry("submitted", "Submitted for approval",
                "CPR submitted for approval by " + currentUserName() + ".",
                "Status", label(previous), "Pending Approval"));
        cpr.addHistory(history("Status", label(previous), "Pending Approval", currentUserName()));
        syncStage(cpr);
        return toResponse(cprRepository.save(cpr));
    }

    public CprResponse approve(Long id, String remarks) {
        Cpr cpr = getCpr(id);
        CprStatus previous = cpr.getStatus();
        if (cpr.getStatus() == CprStatus.CONVERTED || cpr.getStatus() == CprStatus.DELETED) {
            throw new BadRequestException("Cannot approve a CPR in status '" + label(cpr.getStatus()) + "'");
        }
        cpr.setStatus(CprStatus.APPROVED);
        cpr.setApprovalStatus(CprApprovalStatus.APPROVED);
        cpr.setApprovedBy(currentUserName());
        cpr.setApprovalDate(LocalDateTime.now());
        cpr.setRejectedBy(null);
        cpr.setApprovalRemarks(remarks);
        cpr.addTimeline(fieldEntry("approved", "CPR approved", "CPR approved by " + currentUserName() + ".",
                "Status", label(previous), "Approved"));
        cpr.addHistory(history("Approval", label(previous), "Approved", currentUserName()));
        syncStage(cpr);
        return toResponse(cprRepository.save(cpr));
    }

    public CprResponse reject(Long id, String remarks) {
        if (remarks == null || remarks.isBlank()) {
            throw new BadRequestException("Remarks are required to reject a CPR");
        }
        Cpr cpr = getCpr(id);
        CprStatus previous = cpr.getStatus();
        cpr.setStatus(CprStatus.REJECTED);
        cpr.setApprovalStatus(CprApprovalStatus.REJECTED);
        cpr.setRejectedBy(currentUserName());
        cpr.setApprovalDate(LocalDateTime.now());
        cpr.setApprovalRemarks(remarks.trim());
        cpr.addTimeline(fieldEntry("rejected", "CPR rejected",
                "CPR rejected by " + currentUserName() + " - " + remarks.trim() + ".",
                "Status", label(previous), "Rejected"));
        cpr.addHistory(history("Approval", label(previous), "Rejected", currentUserName()));
        syncStage(cpr);
        return toResponse(cprRepository.save(cpr));
    }

    public CprResponse sendBack(Long id, String remarks) {
        if (remarks == null || remarks.isBlank()) {
            throw new BadRequestException("Remarks are required to send a CPR back");
        }
        Cpr cpr = getCpr(id);
        if (cpr.getStatus() != CprStatus.PENDING_APPROVAL) {
            throw new BadRequestException("Only CPRs pending approval can be sent back (current: '"
                    + label(cpr.getStatus()) + "')");
        }
        CprStatus previous = cpr.getStatus();
        cpr.setStatus(CprStatus.REJECTED);
        cpr.setApprovalStatus(CprApprovalStatus.REJECTED);
        cpr.setRejectedBy(currentUserName());
        cpr.setApprovalDate(LocalDateTime.now());
        cpr.setApprovalRemarks("Sent back: " + remarks.trim());
        cpr.addTimeline(fieldEntry("send back", "CPR sent back",
                "CPR sent back by " + currentUserName() + " - " + remarks.trim() + ".",
                "Status", label(previous), "Sent Back"));
        cpr.addHistory(history("Approval", label(previous), "Sent Back", currentUserName()));
        syncStage(cpr);
        return toResponse(cprRepository.save(cpr));
    }

    public CprResponse convertToQuotation(Long id) {
        Cpr cpr = getCpr(id);
        if (cpr.getStatus() != CprStatus.APPROVED) {
            throw new BadRequestException("Only approved CPRs can be converted to a quotation");
        }
        if (cpr.getQuotationId() != null
                || (cpr.getConvertedToQtn() != null && !cpr.getConvertedToQtn().isBlank())) {
            throw new BadRequestException("CPR is already converted to quotation '"
                    + cpr.getConvertedToQtn() + "' — duplicate conversion is not allowed");
        }
        CprStatus previous = cpr.getStatus();
        // Persist a real quotation row (MySQL) and link the CPR to it.
        com.vishatech.erp.dto.QuotationResponse quotation = quotationService.createFromCpr(cpr);
        cpr.setStatus(CprStatus.CONVERTED);
        cpr.setConvertedToQtn(quotation.quotationNo());
        cpr.setQuotationId(quotation.id());
        cpr.addTimeline(fieldEntry("converted", "Converted to quotation",
                "CPR converted to quotation " + quotation.quotationNo() + ".",
                "Status", label(previous), "Converted"));
        cpr.addHistory(history("Status", label(previous), "Converted", currentUserName()));
        syncStage(cpr);
        return toResponse(cprRepository.save(cpr));
    }

    public CprResponse duplicate(Long id) {
        Cpr source = getCpr(id);
        Cpr copy = new Cpr();
        copy.setPrNo(buildPrNo(nextSequence()));
        copy.setDepartment(source.getDepartment());
        copy.setRequestedBy(source.getRequestedBy());
        copy.setPriority(source.getPriority());
        copy.setSourceLead(source.getSourceLead());
        copy.setClientName(source.getClientName());
        copy.setContactPerson(source.getContactPerson());
        copy.setPhone(source.getPhone());
        copy.setEmail(source.getEmail());
        copy.setCompany(source.getCompany());
        copy.setGst(source.getGst());
        copy.setProject(source.getProject());
        copy.setLeadNo(source.getLeadNo());
        copy.setPan(source.getPan());
        copy.setVendor(source.getVendor());
        copy.setBillingAddress(source.getBillingAddress());
        copy.setShippingAddress(source.getShippingAddress());
        copy.setRemarks(source.getRemarks());
        copy.setDescription(source.getDescription());
        copy.setStatus(CprStatus.DRAFT);
        copy.setApprovalStatus(CprApprovalStatus.PENDING);
        copy.setPrDate(LocalDateTime.now());
        for (CprItem sourceItem : source.getItems()) {
            CprItem item = new CprItem();
            item.setDrawingNo(sourceItem.getDrawingNo());
            item.setDescription(sourceItem.getDescription());
            item.setSpecification(sourceItem.getSpecification());
            item.setQty(sourceItem.getQty());
            item.setUnit(sourceItem.getUnit());
            item.setEstimatedCost(sourceItem.getEstimatedCost());
            item.setRemarks(sourceItem.getRemarks());
            copy.addItem(item);
        }
        recalcTotals(copy);
        syncStage(copy);
        copy.addTimeline(entry("created", "CPR created",
                "Duplicated from CPR '" + source.getPrNo() + "'."));
        copy.addHistory(history("CPR", null, copy.getPrNo(), currentUserName()));
        // Record the duplication on the source CPR as well.
        source.addTimeline(fieldEntry("duplicated", "CPR duplicated",
                "CPR '" + source.getPrNo() + "' was duplicated to '" + copy.getPrNo() + "' by " + currentUserName() + ".",
                "Source", source.getPrNo(), copy.getPrNo()));
        cprRepository.save(source);
        return toResponse(cprRepository.save(copy));
    }

    public int bulkArchive(List<Long> ids) {
        int count = 0;
        for (Long id : ids) {
            Cpr cpr = getCpr(id);
            if (cpr.getStatus() != CprStatus.ARCHIVED && cpr.getStatus() != CprStatus.DELETED) {
                cpr.setStatus(CprStatus.ARCHIVED);
                cpr.setArchivedAt(LocalDateTime.now());
                cpr.addTimeline(entry("archived", "CPR archived", "CPR was archived by " + currentUserName() + "."));
                cprRepository.save(cpr);
                count++;
            }
        }
        return count;
    }

    public int bulkRestore(List<Long> ids) {
        int count = 0;
        for (Long id : ids) {
            Cpr cpr = getCpr(id);
            if (cpr.getStatus() == CprStatus.ARCHIVED || cpr.getStatus() == CprStatus.DELETED) {
                cpr.setStatus(CprStatus.DRAFT);
                cpr.setArchivedAt(null);
                cpr.addTimeline(entry("restored", "CPR restored", "CPR was restored by " + currentUserName() + "."));
                cprRepository.save(cpr);
                count++;
            }
        }
        return count;
    }

    public int bulkDelete(List<Long> ids) {
        int count = 0;
        for (Long id : ids) {
            Cpr cpr = getCpr(id);
            if (cpr.getStatus() == CprStatus.DELETED) {
                continue;
            }
            CprStatus previous = cpr.getStatus();
            cpr.setStatus(CprStatus.DELETED);
            cpr.setArchivedAt(LocalDateTime.now());
            cpr.addTimeline(fieldEntry("deleted", "CPR deleted",
                    "CPR was moved to trash by " + currentUserName() + ".",
                    "Status", label(previous), "Deleted"));
            cpr.addHistory(history("Status", label(previous), "Deleted", currentUserName()));
            cprRepository.save(cpr);
            count++;
        }
        return count;
    }

    public int bulkPermanentDelete(List<Long> ids) {
        int count = 0;
        for (Long id : ids) {
            Cpr cpr = getCpr(id);
            // Unlink any Cost Workouts referencing this CPR so the FK (cpr_id)
            // never orphans a Cost Workout when the CPR row is removed.
            costWorkoutRepository.unlinkByCprId(id);
            cprRepository.delete(cpr);
            count++;
        }
        return count;
    }

    // ============================== Export ==============================

    @Transactional
    public List<CprResponse> export(String search, String status, String approval, String department,
                                    String dateFrom, String dateTo, BigDecimal minValue, BigDecimal maxValue) {
        Specification<Cpr> spec = buildSpecification(search, status, approval, department, dateFrom, dateTo, minValue, maxValue);
        return cprRepository.findAll(spec).stream().map(this::toResponse).toList();
    }

    public String buildCsv(List<CprResponse> cprs) {
        StringBuilder sb = new StringBuilder();
        sb.append("CPR No,Lead No,Client,Description,Project,Department,Created By,Cost Workout,Profit %,Status,Date,Amount\n");
        for (CprResponse c : cprs) {
            sb.append(escapeCsv(c.prNo())).append(',')
              .append(escapeCsv(c.leadNo())).append(',')
              .append(escapeCsv(c.clientName())).append(',')
              .append(escapeCsv(c.description())).append(',')
              .append(escapeCsv(c.project())).append(',')
              .append(escapeCsv(c.department())).append(',')
              .append(escapeCsv(c.requestedBy())).append(',')
              .append(c.costWorkout() == null ? "" : c.costWorkout().toPlainString()).append(',')
              .append(c.profitPercent() == null ? "" : c.profitPercent().toPlainString()).append(',')
              .append(escapeCsv(c.status())).append(',')
              .append(escapeCsv(c.date())).append(',')
              .append(c.grandTotal() == null ? "" : c.grandTotal().toPlainString()).append('\n');
        }
        return sb.toString();
    }

    // ============================== Sub-resources ==============================

    @Transactional
    public List<CprTimelineResponse> getTimeline(Long id) {
        return getCpr(id).getTimeline().stream()
                .sorted(Comparator.comparing(CprTimeline::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(this::timelineResponse).toList();
    }

    @Transactional
    public List<CprHistoryResponse> getHistory(Long id) {
        return getCpr(id).getHistory().stream()
                .sorted(Comparator.comparing(CprHistory::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(this::historyResponse).toList();
    }

    @Transactional
    public List<CprAttachmentResponse> getAttachments(Long id) {
        return getCpr(id).getAttachments().stream().map(this::attachmentResponse).toList();
    }

    public CprAttachmentResponse addAttachment(Long id, MultipartFile file) {
        Cpr cpr = getCpr(id);
        String storedName = fileStorageService.store(file);
        CprAttachment attachment = new CprAttachment();
        attachment.setName(file.getOriginalFilename());
        attachment.setStoredName(storedName);
        attachment.setContentType(file.getContentType());
        attachment.setSize(file.getSize());
        attachment.setUrl(baseUrl + "/v1/files/" + storedName);
        cpr.addAttachment(attachment);
        cpr.addTimeline(entry("attachment", "File attached", file.getOriginalFilename()));
        // Flush so the attachment row (and its generated id / uploadedAt) is persisted,
        // then reload the persisted attachment to build a complete response.
        cprRepository.saveAndFlush(cpr);
        entityManager.clear();
        CprAttachment persisted = cprRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("CPR not found with id: " + id))
                .getAttachments().stream()
                .filter(a -> a.getStoredName().equals(storedName))
                .findFirst()
                .orElse(attachment);
        return attachmentResponse(persisted);
    }

    public void deleteAttachment(Long id, Long attachmentId) {
        Cpr cpr = getCpr(id);
        CprAttachment attachment = cpr.getAttachments().stream()
                .filter(a -> a.getId().equals(attachmentId))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Attachment not found with id: " + attachmentId));
        cpr.getAttachments().remove(attachment);
        cprRepository.save(cpr);
    }

    // ============================== Comments ==============================

    @Transactional
    public List<CprCommentResponse> getComments(Long id) {
        return getCpr(id).getComments().stream().map(this::commentResponse).toList();
    }

    public CprCommentResponse addComment(Long id, String text) {
        Cpr cpr = getCpr(id);
        CprComment comment = new CprComment();
        comment.setAuthor(currentUserName());
        comment.setText(text);
        cpr.addComment(comment);
        cpr.addTimeline(entry("comment", "Comment added",
                currentUserName() + " added a comment on " + cpr.getPrNo() + "."));
        cprRepository.saveAndFlush(cpr);
        return commentResponse(comment);
    }

    public CprCommentResponse updateComment(Long id, Long commentId, String text) {
        Cpr cpr = getCpr(id);
        CprComment comment = cpr.getComments().stream()
                .filter(c -> c.getId().equals(commentId))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Comment not found with id: " + commentId));
        String oldText = comment.getText();
        comment.setText(text);
        cpr.addTimeline(fieldEntry("comment", "Comment edited",
                currentUserName() + " edited a comment on " + cpr.getPrNo() + ".",
                "Comment", oldText == null ? "" : oldText, text == null ? "" : text));
        cprRepository.saveAndFlush(cpr);
        return commentResponse(comment);
    }

    public void deleteComment(Long id, Long commentId) {
        Cpr cpr = getCpr(id);
        CprComment comment = cpr.getComments().stream()
                .filter(c -> c.getId().equals(commentId))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Comment not found with id: " + commentId));
        cpr.getComments().remove(comment);
        cpr.addTimeline(entry("comment", "Comment deleted",
                currentUserName() + " deleted a comment on " + cpr.getPrNo() + "."));
        cprRepository.save(cpr);
    }

    // ============================== Reports ==============================

    @Transactional
    public Map<String, Object> reportsSummary() {
        Specification<Cpr> spec = buildSpecification(null, null, null, null, null, null, null, null);
        List<Cpr> all = cprRepository.findAll(spec);

        List<Cpr> pending = new ArrayList<>();
        List<Cpr> approved = new ArrayList<>();
        List<Cpr> converted = new ArrayList<>();
        BigDecimal totalAmt = BigDecimal.ZERO;
        Map<String, BigDecimal[]> deptAgg = new LinkedHashMap<>();
        Map<String, BigDecimal[]> vendorAgg = new LinkedHashMap<>();
        Map<String, BigDecimal[]> monthAgg = new LinkedHashMap<>();

        for (Cpr cpr : all) {
            CprStatus status = cpr.getStatus();
            if (status == CprStatus.ARCHIVED || status == CprStatus.DELETED) {
                continue;
            }
            BigDecimal amount = cpr.getGrandTotal() == null ? BigDecimal.ZERO : cpr.getGrandTotal();
            totalAmt = totalAmt.add(amount);
            boolean isPending = status == CprStatus.PENDING_APPROVAL || status == CprStatus.COST_WORKOUT;
            boolean isConverted = cpr.getConvertedToQtn() != null && !cpr.getConvertedToQtn().isBlank();
            if (isPending) pending.add(cpr);
            if (status == CprStatus.APPROVED) approved.add(cpr);
            if (isConverted) converted.add(cpr);

            String dept = (cpr.getDepartment() == null || cpr.getDepartment().isBlank())
                    ? "Unassigned" : cpr.getDepartment();
            BigDecimal[] d = deptAgg.computeIfAbsent(dept, k -> new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO});
            d[0] = d[0].add(BigDecimal.ONE);
            d[3] = d[3].add(amount);
            if (status == CprStatus.APPROVED) d[1] = d[1].add(BigDecimal.ONE);
            else if (isPending) d[2] = d[2].add(BigDecimal.ONE);

            String vendor = cpr.getVendor() == null ? "" : cpr.getVendor().trim();
            if (!vendor.isBlank()) {
                BigDecimal[] v = vendorAgg.computeIfAbsent(vendor, k -> new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO});
                v[0] = v[0].add(BigDecimal.ONE);
                v[1] = v[1].add(amount);
            }

            String month = cpr.getCreatedAt() == null ? "" : cpr.getCreatedAt().toString().substring(0, 7);
            if (!month.isBlank()) {
                BigDecimal[] m = monthAgg.computeIfAbsent(month, k -> new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO});
                m[0] = m[0].add(BigDecimal.ONE);
                m[1] = m[1].add(amount);
                if (status == CprStatus.APPROVED) m[2] = m[2].add(BigDecimal.ONE);
                if (isConverted) m[3] = m[3].add(BigDecimal.ONE);
            }
        }

        List<Map<String, Object>> deptSummary = new ArrayList<>();
        for (Map.Entry<String, BigDecimal[]> e : deptAgg.entrySet()) {
            BigDecimal[] v = e.getValue();
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("department", e.getKey());
            row.put("count", v[0]);
            row.put("approved", v[1]);
            row.put("pending", v[2]);
            row.put("total", v[3]);
            deptSummary.add(row);
        }

        List<Map<String, Object>> vendorSummary = new ArrayList<>();
        for (Map.Entry<String, BigDecimal[]> e : vendorAgg.entrySet()) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("vendor", e.getKey());
            row.put("count", e.getValue()[0]);
            row.put("total", e.getValue()[1]);
            vendorSummary.add(row);
        }

        List<Map<String, Object>> monthlySummary = new ArrayList<>();
        monthAgg.entrySet().stream()
                .sorted((a, b) -> b.getKey().compareTo(a.getKey()))
                .forEach(e -> {
                    BigDecimal[] v = e.getValue();
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("month", e.getKey());
                    row.put("count", v[0]);
                    row.put("total", v[1]);
                    row.put("approved", v[2]);
                    row.put("converted", v[3]);
                    monthlySummary.add(row);
                });

        // Cost analysis by category — aggregated from the Cost Workout module's
        // category rows (real MySQL data), excluding Lead Time (non-monetary) rows.
        Map<String, BigDecimal[]> costAgg = new LinkedHashMap<>();
        for (CostWorkout cw : costWorkoutRepository.findAll()) {
            if (cw.getStatus() == com.vishatech.erp.entity.CostWorkoutStatus.ARCHIVED
                    || cw.getStatus() == com.vishatech.erp.entity.CostWorkoutStatus.DELETED) {
                continue;
            }
            if (cw.getItems() != null) {
                for (com.vishatech.erp.entity.CostWorkoutItem item : cw.getItems()) {
                    if (item.getCategories() != null) {
                        for (CostWorkoutCategory cat : item.getCategories()) {
                            if (cat.getCategory() != null
                                    && "lead time".equalsIgnoreCase(cat.getCategory().trim())) {
                                continue;
                            }
                            BigDecimal qty = cat.getQty() == null ? BigDecimal.ZERO : cat.getQty();
                            BigDecimal rate = cat.getRate() == null ? BigDecimal.ZERO : cat.getRate();
                            BigDecimal amount = qty.multiply(rate);
                            String category = (cat.getCategory() == null || cat.getCategory().isBlank())
                                    ? "Material Cost" : cat.getCategory();
                            BigDecimal[] c = costAgg.computeIfAbsent(category,
                                    k -> new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO});
                            c[0] = c[0].add(BigDecimal.ONE);
                            c[1] = c[1].add(amount);
                        }
                    }
                }
            }
        }
        List<Map<String, Object>> costAnalysis = new ArrayList<>();
        for (Map.Entry<String, BigDecimal[]> e : costAgg.entrySet()) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("category", e.getKey());
            row.put("count", e.getValue()[0]);
            row.put("total", e.getValue()[1]);
            costAnalysis.add(row);
        }

        Map<String, Object> kpis = new LinkedHashMap<>();
        kpis.put("pending", pending.size());
        kpis.put("approved", approved.size());
        kpis.put("converted", converted.size());
        kpis.put("totalValue", totalAmt);

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("kpis", kpis);
        summary.put("pending", pending.stream().map(this::toResponse).toList());
        summary.put("approved", approved.stream().map(this::toResponse).toList());
        summary.put("converted", converted.stream().map(this::toResponse).toList());
        summary.put("deptSummary", deptSummary);
        summary.put("vendorSummary", vendorSummary);
        summary.put("monthlySummary", monthlySummary);
        summary.put("costAnalysis", costAnalysis);
        return summary;
    }

    // ============================== Mapping ==============================

    private CprResponse toResponse(Cpr cpr) {
        return new CprResponse(
                cpr.getId(),
                cpr.getPrNo(),
                cpr.getPrDate() == null ? null : cpr.getPrDate().toLocalDate().toString(),
                cpr.getDepartment(),
                cpr.getRequestedBy(),
                cpr.getRequiredDate() == null ? null : cpr.getRequiredDate().toLocalDate().toString(),
                cpr.getPriority(),
                statusKey(cpr.getStatus()),
                stageKey(cpr.getStatus()),
                approvalKey(cpr.getApprovalStatus()),
                cpr.getSourceLead(),
                cpr.getClientName(),
                cpr.getContactPerson(),
                cpr.getPhone(),
                cpr.getEmail(),
                cpr.getCompany(),
                cpr.getGst(),
                cpr.getProject(),
                cpr.getLeadNo(),
                cpr.getPan(),
                cpr.getVendor(),
                cpr.getBillingAddress(),
                cpr.getShippingAddress(),
                cpr.getRemarks(),
                cpr.getDescription(),
                cpr.getCostWorkout(),
                cpr.getProfitPercent(),
                cpr.getGrandTotal(),
                cpr.getConvertedToQtn(),
                cpr.getQuotationId(),
                cpr.getCostWorkoutId(),
                cpr.getCostWorkoutCwNo(),
                cpr.getCostWorkoutStatus(),
                cpr.getSubmittedBy(),
                cpr.getSubmittedAt() == null ? null : cpr.getSubmittedAt().toString(),
                cpr.getApprovedBy(),
                cpr.getApprovalDate() == null ? null : cpr.getApprovalDate().toString(),
                cpr.getRejectedBy(),
                cpr.getApprovalRemarks(),
                cpr.getPrDate() == null
                        ? (cpr.getCreatedAt() == null ? null : cpr.getCreatedAt().toLocalDate().toString())
                        : cpr.getPrDate().toLocalDate().toString(),
                cpr.getCreatedAt() == null ? null : cpr.getCreatedAt().toString(),
                cpr.getUpdatedAt() == null ? null : cpr.getUpdatedAt().toString(),
                cpr.getArchivedAt() == null ? null : cpr.getArchivedAt().toString(),
                cpr.getItems().stream().map(this::itemResponse).toList(),
                cpr.getAttachments().stream().map(this::attachmentResponse).toList(),
                cpr.getTimeline().stream().map(this::timelineResponse).toList(),
                cpr.getHistory().stream().map(this::historyResponse).toList(),
                cpr.getComments().stream().map(this::commentResponse).toList()
        );
    }

    private CprItemResponse itemResponse(CprItem item) {
        return new CprItemResponse(item.getId(), item.getDrawingNo(), item.getDescription(),
                item.getSpecification(), item.getQty(), item.getUnit(), item.getEstimatedCost(),
                item.getRemarks(), item.getFileName(), item.getFileSize(), item.getFileType());
    }

    private CprAttachmentResponse attachmentResponse(CprAttachment attachment) {
        return new CprAttachmentResponse(attachment.getId(), attachment.getName(), attachment.getContentType(),
                attachment.getSize(), attachment.getUrl(),
                attachment.getUploadedAt() == null ? null : attachment.getUploadedAt().toString());
    }

    private CprTimelineResponse timelineResponse(CprTimeline entry) {
        return new CprTimelineResponse(entry.getId(), entry.getType(), entry.getTitle(), entry.getDetail(),
                entry.getField(), entry.getOldValue(), entry.getNewValue(),
                entry.getUserId(), entry.getUserName(), entry.getUserRole(),
                entry.getIpAddress(), entry.getDeviceInfo(),
                entry.getCreatedAt() == null ? null : entry.getCreatedAt().toString());
    }

    private CprHistoryResponse historyResponse(CprHistory entry) {
        return new CprHistoryResponse(entry.getId(), entry.getField(), entry.getOldValue(), entry.getNewValue(),
                entry.getChangedBy(), entry.getCreatedAt() == null ? null : entry.getCreatedAt().toString());
    }

    private CprCommentResponse commentResponse(CprComment comment) {
        return new CprCommentResponse(comment.getId(), comment.getAuthor(), comment.getText(),
                comment.getCreatedAt() == null ? null : comment.getCreatedAt().toString(),
                comment.getUpdatedAt() == null ? null : comment.getUpdatedAt().toString());
    }

    private CprTimeline entry(String type, String title, String detail) {
        CprTimeline entry = new CprTimeline();
        entry.setType(type);
        entry.setTitle(title);
        entry.setDetail(detail);
        return withAudit(entry);
    }

    private CprTimeline fieldEntry(String type, String title, String detail, String field,
                                   String oldValue, String newValue) {
        CprTimeline entry = entry(type, title, detail);
        entry.setField(field);
        entry.setOldValue(oldValue);
        entry.setNewValue(newValue);
        return entry;
    }

    /** Stamp who / from where onto an audit record. */
    private CprTimeline withAudit(CprTimeline entry) {
        entry.setUserId(auditContext.currentUserId());
        entry.setUserName(auditContext.currentUserName());
        entry.setUserRole(auditContext.currentUserRole());
        entry.setIpAddress(auditContext.ipAddress());
        String device = auditContext.deviceInfo();
        entry.setDeviceInfo(device != null && device.length() > 500 ? device.substring(0, 500) : device);
        return entry;
    }

    /** Snapshot the tracked display fields as strings for change comparison. */
    private Map<String, String> snapshotFields(Cpr cpr) {
        Map<String, String> m = new LinkedHashMap<>();
        m.put("department", cpr.getDepartment());
        m.put("requestedBy", cpr.getRequestedBy());
        m.put("priority", cpr.getPriority());
        m.put("sourceLead", cpr.getSourceLead());
        m.put("clientName", cpr.getClientName());
        m.put("contactPerson", cpr.getContactPerson());
        m.put("phone", cpr.getPhone());
        m.put("email", cpr.getEmail());
        m.put("company", cpr.getCompany());
        m.put("gst", cpr.getGst());
        m.put("project", cpr.getProject());
        m.put("leadNo", cpr.getLeadNo());
        m.put("pan", cpr.getPan());
        m.put("vendor", cpr.getVendor());
        m.put("billingAddress", cpr.getBillingAddress());
        m.put("shippingAddress", cpr.getShippingAddress());
        m.put("remarks", cpr.getRemarks());
        m.put("description", cpr.getDescription());
        m.put("costWorkout", cpr.getCostWorkout() == null ? null : cpr.getCostWorkout().toPlainString());
        m.put("profitPercent", cpr.getProfitPercent() == null ? null : cpr.getProfitPercent().toPlainString());
        m.put("status", cpr.getStatus() == null ? null : label(cpr.getStatus()));
        m.put("approvalStatus", cpr.getApprovalStatus() == null ? null : label(cpr.getApprovalStatus()));
        m.put("items", String.valueOf(cpr.getItems().size()));
        return m;
    }

    /** Compare before/after snapshots and build one audit entry per changed field. */
    private List<CprTimeline> changedFields(Map<String, String> before, Cpr cpr) {
        Map<String, String> after = snapshotFields(cpr);
        List<CprTimeline> out = new ArrayList<>();
        for (Map.Entry<String, String> e : before.entrySet()) {
            String key = e.getKey();
            String oldV = e.getValue();
            String newV = after.get(key);
            if (!Objects.equals(oldV, newV)) {
                out.add(fieldEntry("field", "Field updated",
                        "Field '" + key + "' was updated by " + currentUserName() + ".",
                        key, oldV == null ? "" : oldV, newV == null ? "" : newV));
            }
        }
        return out;
    }

    private CprHistory history(String field, String oldValue, String newValue, String changedBy) {
        CprHistory entry = new CprHistory();
        entry.setField(field);
        entry.setOldValue(oldValue);
        entry.setNewValue(newValue);
        entry.setChangedBy(changedBy);
        return entry;
    }

    // ============================== Helpers ==============================

    private Cpr getCpr(Long id) {
        return cprRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("CPR not found with id: " + id));
    }

    private void applyRequest(Cpr cpr, CprRequest request) {
        cpr.setPrDate(parseDate(request.prDate()));
        cpr.setDepartment(request.department());
        cpr.setRequestedBy(request.requestedBy());
        cpr.setRequiredDate(parseDate(request.requiredDate()));
        cpr.setPriority(request.priority());
        cpr.setSourceLead(request.sourceLead());
        cpr.setClientName(request.clientName());
        cpr.setContactPerson(request.contactPerson());
        cpr.setPhone(request.phone());
        cpr.setEmail(request.email());
        cpr.setCompany(request.company());
        cpr.setGst(request.gst());
        cpr.setProject(request.project());
        cpr.setLeadNo(request.leadNo());
        cpr.setPan(request.pan());
        cpr.setVendor(request.vendor());
        cpr.setBillingAddress(request.billingAddress());
        cpr.setShippingAddress(request.shippingAddress());
        cpr.setRemarks(request.remarks());
        cpr.setDescription(request.description());
        cpr.setCostWorkout(request.costWorkout());
        cpr.setProfitPercent(request.profitPercent());
        if (request.convertedToQtn() != null) {
            cpr.setConvertedToQtn(request.convertedToQtn());
        }
        cpr.getItems().clear();
        if (request.items() != null) {
            for (CprItemRequest itemRequest : request.items()) {
                if (itemRequest == null) {
                    continue;
                }
                CprItem item = new CprItem();
                item.setDrawingNo(itemRequest.drawingNo());
                item.setDescription(itemRequest.description());
                item.setSpecification(itemRequest.specification());
                item.setQty(itemRequest.qty() == null ? BigDecimal.ONE : itemRequest.qty());
                item.setUnit(itemRequest.unit());
                item.setEstimatedCost(itemRequest.estimatedCost() == null ? BigDecimal.ZERO : itemRequest.estimatedCost());
                item.setRemarks(itemRequest.remarks());
                item.setFileName(itemRequest.fileName());
                item.setFileSize(itemRequest.fileSize() == null ? 0 : itemRequest.fileSize());
                item.setFileType(itemRequest.fileType());
                cpr.addItem(item);
            }
        }
    }

    private void recalcTotals(Cpr cpr) {
        BigDecimal total = cpr.getItems().stream()
                .filter(it -> it.getQty() != null && it.getEstimatedCost() != null)
                .map(it -> it.getQty().multiply(it.getEstimatedCost()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        cpr.setGrandTotal(total);
        BigDecimal costWorkout = cpr.getCostWorkout();
        if (costWorkout != null && costWorkout.compareTo(BigDecimal.ZERO) > 0 && total.compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal profit = total.subtract(costWorkout)
                    .divide(costWorkout, 4, java.math.RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100));
            cpr.setProfitPercent(profit.setScale(2, java.math.RoundingMode.HALF_UP));
        } else {
            cpr.setProfitPercent(null);
        }
    }

    private void syncStage(Cpr cpr) {
        cpr.setCurrentStage(stageKey(cpr.getStatus()));
    }

    private Specification<Cpr> buildSpecification(String search, String status, String approval,
                                                  String department, String dateFrom, String dateTo,
                                                  BigDecimal minValue, BigDecimal maxValue) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (search != null && !search.isBlank()) {
                String like = "%" + search.trim().toLowerCase() + "%";
                // description is a @Lob TEXT column; lower() on a LOB fails on MySQL,
                // so cast it to a string before applying lower().
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("prNo")), like),
                        cb.like(cb.lower(root.get("clientName")), like),
                        cb.like(cb.lower(root.get("leadNo")), like),
                        cb.like(cb.lower(cb.toString(root.get("description"))), like),
                        cb.like(cb.lower(root.get("project")), like),
                        cb.like(cb.lower(root.get("department")), like),
                        cb.like(cb.lower(root.get("requestedBy")), like),
                        cb.like(cb.lower(root.get("company")), like)
                ));
            }
            if (status != null && !status.isBlank()) {
                predicates.add(cb.equal(root.get("status"), parseStatus(status)));
            } else {
                predicates.add(cb.not(root.get("status").in(CprStatus.ARCHIVED, CprStatus.DELETED)));
            }
            if (approval != null && !approval.isBlank()) {
                predicates.add(cb.equal(root.get("approvalStatus"), parseApprovalStatus(approval)));
            }
            if (department != null && !department.isBlank()) {
                predicates.add(cb.equal(cb.lower(root.get("department")), department.trim().toLowerCase()));
            }
            if (dateFrom != null && !dateFrom.isBlank()) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), LocalDate.parse(dateFrom).atStartOfDay()));
            }
            if (dateTo != null && !dateTo.isBlank()) {
                predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), LocalDate.parse(dateTo).atTime(23, 59, 59)));
            }
            if (minValue != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("grandTotal"), minValue));
            }
            if (maxValue != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("grandTotal"), maxValue));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    private Sort buildSort(String sort) {
        if (sort == null || sort.isBlank()) {
            return Sort.by(Sort.Direction.DESC, "createdAt");
        }
        String[] parts = sort.split(",");
        String field = parts[0];
        String mapped = switch (field) {
            case "prNo", "client", "clientName", "department", "requestedBy", "createdBy", "status", "grandTotal",
                 "createdAt", "updatedAt", "leadNo", "project" -> "createdAt".equals(field) ? "createdAt"
                    : "updatedAt".equals(field) ? "updatedAt"
                    : "client".equals(field) ? "clientName"
                    : "createdBy".equals(field) ? "requestedBy" : field;
            default -> "createdAt";
        };
        boolean asc = parts.length > 1 && "asc".equalsIgnoreCase(parts[1]);
        return Sort.by(asc ? Sort.Direction.ASC : Sort.Direction.DESC, mapped);
    }

    private long nextSequence() {
        long count = cprRepository.count();
        List<Cpr> all = cprRepository.findAll();
        long maxSuffix = 0;
        String prefix = "CPR-" + Year.now().getValue() + "-";
        for (Cpr cpr : all) {
            String prNo = cpr.getPrNo();
            if (prNo != null && prNo.startsWith(prefix)) {
                try {
                    maxSuffix = Math.max(maxSuffix, Long.parseLong(prNo.substring(prefix.length())));
                } catch (NumberFormatException ignored) {
                    // skip malformed numbers
                }
            }
        }
        return Math.max(count, maxSuffix) + 1;
    }

    private String buildPrNo(long sequence) {
        return String.format("CPR-%d-%06d", Year.now().getValue(), sequence);
    }

    private LocalDateTime parseDate(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            if (value.length() <= 10) {
                return LocalDate.parse(value, DATE_FMT).atStartOfDay();
            }
            return LocalDateTime.parse(value);
        } catch (Exception e) {
            return null;
        }
    }

    private CprStatus parseStatus(String value) {
        String normalized = value.trim().toUpperCase().replace(" ", "_").replace("-", "_");
        // The CPR form offers a "Submitted" status option; map it to the backend
        // PENDING_APPROVAL status instead of rejecting it.
        if ("SUBMITTED".equals(normalized)) {
            return CprStatus.PENDING_APPROVAL;
        }
        try {
            return CprStatus.valueOf(normalized);
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Invalid status: " + value);
        }
    }

    private CprApprovalStatus parseApprovalStatus(String value) {
        try {
            return CprApprovalStatus.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Invalid approval status: " + value);
        }
    }

    private String statusKey(CprStatus status) {
        if (status == null) {
            return "draft";
        }
        return switch (status) {
            case COST_WORKOUT -> "cost workout";
            case PENDING_APPROVAL -> "pending approval";
            case APPROVED -> "approved";
            case REJECTED -> "rejected";
            case CONVERTED -> "converted";
            case ARCHIVED -> "archived";
            case DELETED -> "deleted";
            default -> "draft";
        };
    }

    private String stageKey(CprStatus status) {
        if (status == null) {
            return "Draft";
        }
        return switch (status) {
            case COST_WORKOUT -> "Cost Workout";
            case PENDING_APPROVAL -> "Approval";
            case APPROVED -> "Approved";
            case REJECTED -> "Rejected";
            case CONVERTED -> "Converted";
            case ARCHIVED -> "Archived";
            case DELETED -> "Deleted";
            default -> "Draft";
        };
    }

    private String approvalKey(CprApprovalStatus status) {
        if (status == null) {
            return "";
        }
        return switch (status) {
            case APPROVED -> "Approved";
            case REJECTED -> "Rejected";
            default -> "Pending";
        };
    }

    private String label(Enum<?> value) {
        if (value == null) {
            return null;
        }
        return value.name().substring(0, 1) + value.name().substring(1).toLowerCase().replace("_", " ");
    }

    private String escapeCsv(String value) {
        if (value == null) {
            return "";
        }
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }

    private String currentUserName() {
        return auditContext.currentUserName();
    }
}
