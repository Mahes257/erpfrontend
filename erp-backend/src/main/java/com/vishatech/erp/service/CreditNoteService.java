package com.vishatech.erp.service;

import com.vishatech.erp.dto.CreditNoteItemRequest;
import com.vishatech.erp.dto.CreditNoteItemResponse;
import com.vishatech.erp.dto.CreditNoteNextNumberResponse;
import com.vishatech.erp.dto.CreditNoteRequest;
import com.vishatech.erp.dto.CreditNoteResponse;
import com.vishatech.erp.dto.SalesAttachmentResponse;
import com.vishatech.erp.dto.SalesHistoryResponse;
import com.vishatech.erp.dto.SalesTimelineResponse;
import com.vishatech.erp.entity.CreditNote;
import com.vishatech.erp.entity.CreditNoteItem;
import com.vishatech.erp.entity.SalesAttachment;
import com.vishatech.erp.entity.SalesHistory;
import com.vishatech.erp.entity.SalesTimeline;
import com.vishatech.erp.exception.BadRequestException;
import com.vishatech.erp.exception.ResourceNotFoundException;
import com.vishatech.erp.repository.CreditNoteRepository;
import com.vishatech.erp.repository.SalesAttachmentRepository;
import com.vishatech.erp.repository.SalesHistoryRepository;
import com.vishatech.erp.repository.SalesTimelineRepository;
import jakarta.persistence.criteria.Predicate;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Year;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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
public class CreditNoteService {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final String MODULE = "credit-note";

    private final CreditNoteRepository creditNoteRepository;
    private final SalesTimelineRepository timelineRepository;
    private final SalesHistoryRepository historyRepository;
    private final SalesAttachmentRepository attachmentRepository;
    private final FileStorageService fileStorageService;
    private final String baseUrl;

    public CreditNoteService(CreditNoteRepository creditNoteRepository,
                             SalesTimelineRepository timelineRepository,
                             SalesHistoryRepository historyRepository,
                             SalesAttachmentRepository attachmentRepository,
                             FileStorageService fileStorageService,
                             @Value("${app.base-url:http://localhost:8080}") String baseUrl) {
        this.creditNoteRepository = creditNoteRepository;
        this.timelineRepository = timelineRepository;
        this.historyRepository = historyRepository;
        this.attachmentRepository = attachmentRepository;
        this.fileStorageService = fileStorageService;
        this.baseUrl = baseUrl;
    }

    public Page<CreditNoteResponse> list(int page, int size, String search, String sort,
                                         String status, String client, String reason,
                                         String dateFrom, String dateTo,
                                         BigDecimal minAmount, BigDecimal maxAmount) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(size, 1), 200);
        Pageable pageable = PageRequest.of(safePage, safeSize, buildSort(sort));
        Specification<CreditNote> spec = buildSpecification(search, status, client, reason,
                dateFrom, dateTo, minAmount, maxAmount);
        return creditNoteRepository.findAll(spec, pageable).map(this::toResponse);
    }

    public CreditNoteResponse get(Long id) {
        return toResponse(getCn(id));
    }

    public CreditNoteNextNumberResponse getNextNumber() {
        long next = nextSequence();
        return new CreditNoteNextNumberResponse(buildNo(next), next);
    }

    public Map<String, Object> stats() {
        List<String> excluded = List.of("archived", "deleted");
        Map<String, Object> stats = new LinkedHashMap<>();
        long active = 0;
        for (String status : List.of("draft", "pending approval", "approved", "issued", "adjusted", "refunded", "cancelled")) {
            long count = creditNoteRepository.countByStatus(status);
            stats.put(status.replace(" ", ""), count);
            active += count;
        }
        stats.put("total", active);
        stats.put("active", active);
        stats.put("archived", creditNoteRepository.countByStatus("archived"));
        stats.put("deleted", creditNoteRepository.countByStatus("deleted"));
        stats.put("totalAmt", creditNoteRepository.sumGrandTotalExcluding(excluded));
        return stats;
    }

    public CreditNoteResponse create(CreditNoteRequest request, boolean draft) {
        CreditNote cn = new CreditNote();
        if (request.cnNo() != null && !request.cnNo().isBlank()) {
            if (creditNoteRepository.existsByCnNo(request.cnNo().trim())) {
                throw new BadRequestException("Credit Note number already exists: " + request.cnNo());
            }
            cn.setCnNo(request.cnNo().trim());
        } else {
            cn.setCnNo(buildNo(nextSequence()));
        }
        applyRequest(cn, request);
        if (draft) {
            cn.setStatus("draft");
        } else if (request.status() != null && !request.status().isBlank()) {
            cn.setStatus(normalizeStatus(request.status()));
        } else {
            cn.setStatus("draft");
        }
        recalcTotals(cn);
        CreditNote saved = creditNoteRepository.save(cn);
        addTimeline(saved, "created", "Credit Note created",
                "Credit Note '" + saved.getCnNo() + "' was created.");
        addHistory(saved, "Credit Note", null, saved.getCnNo(), currentUserName());
        return toResponse(saved);
    }

    public CreditNoteResponse update(Long id, CreditNoteRequest request) {
        CreditNote cn = getCn(id);
        applyRequest(cn, request);
        if (request.status() != null && !request.status().isBlank()) {
            cn.setStatus(normalizeStatus(request.status()));
        }
        recalcTotals(cn);
        addTimeline(cn, "updated", "Credit Note updated",
                "Credit Note details were updated by " + currentUserName() + ".");
        return toResponse(creditNoteRepository.save(cn));
    }

    public CreditNoteResponse delete(Long id) {
        CreditNote cn = getCn(id);
        cn.setStatus("deleted");
        cn.setArchivedAt(LocalDateTime.now());
        addTimeline(cn, "deleted", "Credit Note deleted",
                "Credit Note was moved to trash by " + currentUserName() + ".");
        addHistory(cn, "Status", null, "Deleted", currentUserName());
        return toResponse(creditNoteRepository.save(cn));
    }

    public CreditNoteResponse restore(Long id) {
        CreditNote cn = getCn(id);
        String previous = cn.getStatus();
        String target = ("deleted".equals(previous) || "archived".equals(previous)) ? "draft" : previous;
        cn.setStatus(target);
        cn.setArchivedAt(null);
        addTimeline(cn, "restored", "Credit Note restored",
                "Credit Note was restored by " + currentUserName() + ".");
        addHistory(cn, "Status", titleCase(previous), titleCase(target), currentUserName());
        return toResponse(creditNoteRepository.save(cn));
    }

    public CreditNoteResponse archive(Long id) {
        CreditNote cn = getCn(id);
        cn.setStatus("archived");
        cn.setArchivedAt(LocalDateTime.now());
        addTimeline(cn, "archived", "Credit Note archived",
                "Credit Note was archived by " + currentUserName() + ".");
        addHistory(cn, "Status", null, "Archived", currentUserName());
        return toResponse(creditNoteRepository.save(cn));
    }

    public CreditNoteResponse changeStatus(Long id, String status) {
        CreditNote cn = getCn(id);
        String normalized = normalizeStatus(status);
        if ("deleted".equals(cn.getStatus())) {
            throw new BadRequestException("Cannot change status of a deleted Credit Note");
        }
        cn.setStatus(normalized);
        addTimeline(cn, "status", "Status changed",
                "Status changed to '" + titleCase(normalized) + "' by " + currentUserName() + ".");
        addHistory(cn, "Status", null, titleCase(normalized), currentUserName());
        return toResponse(creditNoteRepository.save(cn));
    }

    public CreditNoteResponse approve(Long id) {
        CreditNote cn = getCn(id);
        if ("deleted".equals(cn.getStatus())) {
            throw new BadRequestException("Cannot approve a deleted Credit Note");
        }
        cn.setStatus("approved");
        addTimeline(cn, "approved", "Credit Note approved",
                "Credit Note approved by " + currentUserName() + ".");
        addHistory(cn, "Status", null, "Approved", currentUserName());
        return toResponse(creditNoteRepository.save(cn));
    }

    public CreditNoteResponse issue(Long id) {
        CreditNote cn = getCn(id);
        cn.setStatus("issued");
        addTimeline(cn, "issued", "Credit Note issued",
                "Credit Note issued by " + currentUserName() + ".");
        addHistory(cn, "Status", null, "Issued", currentUserName());
        return toResponse(creditNoteRepository.save(cn));
    }

    public CreditNoteResponse duplicate(Long id) {
        CreditNote source = getCn(id);
        CreditNote copy = new CreditNote();
        copy.setCnNo(buildNo(nextSequence()));
        copy.setSource(source.getSource());
        copy.setSourceRef(source.getSourceRef());
        copy.setReason(source.getReason());
        copy.setReasonDetail(source.getReasonDetail());
        copy.setInventoryImpact(source.getInventoryImpact());
        copy.setReturnQty(source.getReturnQty());
        copy.setCompanyName(source.getCompanyName());
        copy.setCompanyGstin(source.getCompanyGstin());
        copy.setCompanyPan(source.getCompanyPan());
        copy.setCompanyState(source.getCompanyState());
        copy.setCompanyAddress(source.getCompanyAddress());
        copy.setClientId(source.getClientId());
        copy.setClientName(source.getClientName());
        copy.setContactPerson(source.getContactPerson());
        copy.setGstin(source.getGstin());
        copy.setEmail(source.getEmail());
        copy.setPhone(source.getPhone());
        copy.setDiscountPct(source.getDiscountPct());
        copy.setCharges(source.getCharges());
        copy.setStatus("draft");
        copy.setCnDate(LocalDateTime.now());
        for (CreditNoteItem sourceItem : source.getItems()) {
            CreditNoteItem item = new CreditNoteItem();
            copyItem(item, sourceItem);
            copy.addItem(item);
        }
        recalcTotals(copy);
        CreditNote saved = creditNoteRepository.save(copy);
        addTimeline(saved, "created", "Credit Note created",
                "Duplicated from Credit Note '" + source.getCnNo() + "'.");
        addHistory(saved, "Credit Note", null, saved.getCnNo(), currentUserName());
        return toResponse(saved);
    }

    public int bulkArchive(List<Long> ids) {
        int count = 0;
        for (Long id : ids) {
            CreditNote cn = getCn(id);
            if (!"archived".equals(cn.getStatus()) && !"deleted".equals(cn.getStatus())) {
                cn.setStatus("archived");
                cn.setArchivedAt(LocalDateTime.now());
                addTimeline(cn, "archived", "Credit Note archived",
                        "Credit Note was archived by " + currentUserName() + ".");
                creditNoteRepository.save(cn);
                count++;
            }
        }
        return count;
    }

    public int bulkRestore(List<Long> ids) {
        int count = 0;
        for (Long id : ids) {
            CreditNote cn = getCn(id);
            if ("archived".equals(cn.getStatus()) || "deleted".equals(cn.getStatus())) {
                cn.setStatus("draft");
                cn.setArchivedAt(null);
                addTimeline(cn, "restored", "Credit Note restored",
                        "Credit Note was restored by " + currentUserName() + ".");
                creditNoteRepository.save(cn);
                count++;
            }
        }
        return count;
    }

    public int bulkDelete(List<Long> ids) {
        List<CreditNote> cns = creditNoteRepository.findAllById(ids);
        creditNoteRepository.deleteAll(cns);
        return cns.size();
    }

    public List<CreditNoteResponse> export(String search, String status, String client, String reason,
                                           String dateFrom, String dateTo,
                                           BigDecimal minAmount, BigDecimal maxAmount) {
        Specification<CreditNote> spec = buildSpecification(search, status, client, reason,
                dateFrom, dateTo, minAmount, maxAmount);
        return creditNoteRepository.findAll(spec).stream().map(this::toResponse).toList();
    }

    public String buildCsv(List<CreditNoteResponse> cns) {
        StringBuilder sb = new StringBuilder();
        sb.append("Credit Note No,Date,Client,Reason,Status,Items,Amount,Created\n");
        for (CreditNoteResponse c : cns) {
            sb.append(escapeCsv(c.cnNo())).append(',')
              .append(escapeCsv(c.date())).append(',')
              .append(escapeCsv(c.clientName())).append(',')
              .append(escapeCsv(c.reason())).append(',')
              .append(escapeCsv(c.status())).append(',')
              .append(c.itemsCount() == null ? "" : c.itemsCount()).append(',')
              .append(c.grandTotal() == null ? "" : c.grandTotal().toPlainString()).append(',')
              .append(escapeCsv(c.createdAt())).append('\n');
        }
        return sb.toString();
    }

    public List<SalesTimelineResponse> getTimeline(Long id) {
        getCn(id);
        return timelineRepository.findByModuleTypeAndModuleIdOrderByCreatedAtAsc(MODULE, id)
                .stream().map(this::timelineResponse).toList();
    }

    public List<SalesHistoryResponse> getHistory(Long id) {
        getCn(id);
        return historyRepository.findByModuleTypeAndModuleIdOrderByCreatedAtAsc(MODULE, id)
                .stream().map(this::historyResponse).toList();
    }

    public List<SalesAttachmentResponse> getAttachments(Long id) {
        getCn(id);
        return attachmentRepository.findByModuleTypeAndModuleIdOrderByUploadedAtAsc(MODULE, id)
                .stream().map(this::attachmentResponse).toList();
    }

    public SalesAttachmentResponse addAttachment(Long id, MultipartFile file) {
        getCn(id);
        String storedName = fileStorageService.store(file);
        SalesAttachment attachment = new SalesAttachment();
        attachment.setModuleType(MODULE);
        attachment.setModuleId(id);
        attachment.setName(file.getOriginalFilename());
        attachment.setStoredName(storedName);
        attachment.setContentType(file.getContentType());
        attachment.setSize(file.getSize());
        attachment.setUrl(baseUrl + "/v1/files/" + storedName);
        SalesAttachment saved = attachmentRepository.save(attachment);
        addTimeline(id, "attachment", "File attached", file.getOriginalFilename());
        return attachmentResponse(saved);
    }

    public void deleteAttachment(Long id, Long attachmentId) {
        getCn(id);
        SalesAttachment attachment = attachmentRepository.findById(attachmentId)
                .filter(a -> MODULE.equals(a.getModuleType()) && id.equals(a.getModuleId()))
                .orElseThrow(() -> new ResourceNotFoundException("Attachment not found with id: " + attachmentId));
        attachmentRepository.delete(attachment);
    }

    private CreditNoteResponse toResponse(CreditNote cn) {
        List<CreditNoteItemResponse> itemResponses = cn.getItems().stream().map(this::itemResponse).toList();
        BigDecimal totalQty = itemResponses.stream()
                .map(CreditNoteItemResponse::qty)
                .filter(java.util.Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return new CreditNoteResponse(
                cn.getId(), cn.getCnNo(),
                cn.getCnDate() == null ? null : cn.getCnDate().toLocalDate().toString(),
                cn.getStatus(), cn.getSource(), cn.getSourceRef(), cn.getReason(),
                cn.getRefundAmount(), cn.getReturnQty(), cn.getReasonDetail(), cn.getInventoryImpact(),
                cn.getCompanyName(), cn.getCompanyGstin(), cn.getCompanyPan(), cn.getCompanyState(),
                cn.getCompanyAddress(),
                cn.getClientId(), cn.getClientName(), cn.getContactPerson(),
                cn.getGstin(), cn.getEmail(), cn.getPhone(),
                cn.getSubTotal(), cn.getDiscount(), cn.getDiscountPct(),
                cn.getCgstTotal(), cn.getSgstTotal(), cn.getTaxTotal(),
                cn.getCharges(), cn.getGrandTotal(),
                itemResponses.size(), totalQty,
                cn.getCnDate() == null
                        ? (cn.getCreatedAt() == null ? null : cn.getCreatedAt().toLocalDate().toString())
                        : cn.getCnDate().toLocalDate().toString(),
                cn.getCreatedAt() == null ? null : cn.getCreatedAt().toString(),
                cn.getUpdatedAt() == null ? null : cn.getUpdatedAt().toString(),
                cn.getArchivedAt() == null ? null : cn.getArchivedAt().toString(),
                itemResponses,
                attachmentRepository.findByModuleTypeAndModuleIdOrderByUploadedAtAsc(MODULE, cn.getId())
                        .stream().map(this::attachmentResponse).toList(),
                timelineRepository.findByModuleTypeAndModuleIdOrderByCreatedAtAsc(MODULE, cn.getId())
                        .stream().map(this::timelineResponse).toList(),
                historyRepository.findByModuleTypeAndModuleIdOrderByCreatedAtAsc(MODULE, cn.getId())
                        .stream().map(this::historyResponse).toList()
        );
    }

    private CreditNoteItemResponse itemResponse(CreditNoteItem item) {
        BigDecimal qty = nvl(item.getQty(), BigDecimal.ONE);
        BigDecimal rate = nvl(item.getRate(), BigDecimal.ZERO);
        BigDecimal discPct = nvl(item.getDiscountPct(), BigDecimal.ZERO);
        BigDecimal gst = nvl(item.getGstRate(), BigDecimal.ZERO);
        BigDecimal gross = qty.multiply(rate);
        BigDecimal discAmt = gross.multiply(discPct).divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP);
        BigDecimal net = gross.subtract(discAmt);
        BigDecimal cgst = net.multiply(gst).divide(BigDecimal.valueOf(200), 4, RoundingMode.HALF_UP);
        BigDecimal sgst = net.multiply(gst).divide(BigDecimal.valueOf(200), 4, RoundingMode.HALF_UP);
        BigDecimal total = net.add(cgst).add(sgst);
        return new CreditNoteItemResponse(item.getId(), item.getDescription(), item.getSku(), item.getHsn(),
                item.getUom(), qty, rate, discPct, gst,
                gross.setScale(2, RoundingMode.HALF_UP), discAmt.setScale(2, RoundingMode.HALF_UP),
                net.setScale(2, RoundingMode.HALF_UP), cgst.setScale(2, RoundingMode.HALF_UP),
                sgst.setScale(2, RoundingMode.HALF_UP), total.setScale(2, RoundingMode.HALF_UP));
    }

    private SalesAttachmentResponse attachmentResponse(SalesAttachment attachment) {
        return new SalesAttachmentResponse(attachment.getId(), attachment.getName(), attachment.getContentType(),
                attachment.getSize(), attachment.getUrl(),
                attachment.getUploadedAt() == null ? null : attachment.getUploadedAt().toString());
    }

    private SalesTimelineResponse timelineResponse(SalesTimeline entry) {
        return new SalesTimelineResponse(entry.getId(), entry.getType(), entry.getTitle(), entry.getDetail(),
                entry.getCreatedAt() == null ? null : entry.getCreatedAt().toString());
    }

    private SalesHistoryResponse historyResponse(SalesHistory entry) {
        return new SalesHistoryResponse(entry.getId(), entry.getField(), entry.getOldValue(), entry.getNewValue(),
                entry.getChangedBy(), entry.getCreatedAt() == null ? null : entry.getCreatedAt().toString());
    }

    private CreditNote getCn(Long id) {
        return creditNoteRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Credit Note not found with id: " + id));
    }

    private void applyRequest(CreditNote cn, CreditNoteRequest request) {
        cn.setCnDate(parseDate(request.cnDate()));
        cn.setSource(request.source());
        cn.setSourceRef(request.sourceRef());
        cn.setReason(request.reason());
        cn.setRefundAmount(request.refundAmount() == null ? BigDecimal.ZERO : request.refundAmount());
        cn.setReturnQty(request.returnQty() == null ? BigDecimal.ZERO : request.returnQty());
        cn.setReasonDetail(request.reasonDetail());
        cn.setInventoryImpact(request.inventoryImpact());
        cn.setCompanyName(request.companyName());
        cn.setCompanyGstin(request.companyGstin());
        cn.setCompanyPan(request.companyPan());
        cn.setCompanyState(request.companyState());
        cn.setCompanyAddress(request.companyAddress());
        cn.setClientId(request.clientId());
        cn.setClientName(request.clientName());
        cn.setContactPerson(request.contactPerson());
        cn.setGstin(request.gstin());
        cn.setEmail(request.email());
        cn.setPhone(request.phone());
        cn.setDiscountPct(request.discountPct() == null ? BigDecimal.ZERO : request.discountPct());
        cn.setCharges(request.charges() == null ? BigDecimal.ZERO : request.charges());
        cn.getItems().clear();
        if (request.items() != null) {
            for (CreditNoteItemRequest itemRequest : request.items()) {
                if (itemRequest == null) {
                    continue;
                }
                CreditNoteItem item = new CreditNoteItem();
                item.setDescription(itemRequest.description());
                item.setSku(itemRequest.sku());
                item.setHsn(itemRequest.hsn());
                item.setUom(itemRequest.uom());
                item.setQty(nvl(itemRequest.qty(), BigDecimal.ONE));
                item.setRate(nvl(itemRequest.rate(), BigDecimal.ZERO));
                item.setDiscountPct(nvl(itemRequest.discountPct(), BigDecimal.ZERO));
                item.setGstRate(nvl(itemRequest.gstRate(), BigDecimal.ZERO));
                cn.addItem(item);
            }
        }
    }

    private void copyItem(CreditNoteItem target, CreditNoteItem source) {
        target.setDescription(source.getDescription());
        target.setSku(source.getSku());
        target.setHsn(source.getHsn());
        target.setUom(source.getUom());
        target.setQty(source.getQty());
        target.setRate(source.getRate());
        target.setDiscountPct(source.getDiscountPct());
        target.setGstRate(source.getGstRate());
    }

    private void recalcTotals(CreditNote cn) {
        BigDecimal subTotal = BigDecimal.ZERO;
        BigDecimal cgstTotal = BigDecimal.ZERO;
        BigDecimal sgstTotal = BigDecimal.ZERO;
        for (CreditNoteItem item : cn.getItems()) {
            BigDecimal qty = nvl(item.getQty(), BigDecimal.ONE);
            BigDecimal rate = nvl(item.getRate(), BigDecimal.ZERO);
            BigDecimal discPct = nvl(item.getDiscountPct(), BigDecimal.ZERO);
            BigDecimal gst = nvl(item.getGstRate(), BigDecimal.ZERO);
            BigDecimal gross = qty.multiply(rate);
            BigDecimal discAmt = gross.multiply(discPct).divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP);
            BigDecimal net = gross.subtract(discAmt);
            BigDecimal cgst = net.multiply(gst).divide(BigDecimal.valueOf(200), 4, RoundingMode.HALF_UP);
            BigDecimal sgst = net.multiply(gst).divide(BigDecimal.valueOf(200), 4, RoundingMode.HALF_UP);
            subTotal = subTotal.add(net);
            cgstTotal = cgstTotal.add(cgst);
            sgstTotal = sgstTotal.add(sgst);
        }
        cn.setSubTotal(subTotal.setScale(2, RoundingMode.HALF_UP));
        cn.setCgstTotal(cgstTotal.setScale(2, RoundingMode.HALF_UP));
        cn.setSgstTotal(sgstTotal.setScale(2, RoundingMode.HALF_UP));
        BigDecimal taxTotal = cgstTotal.add(sgstTotal);
        cn.setTaxTotal(taxTotal.setScale(2, RoundingMode.HALF_UP));
        BigDecimal discountPct = nvl(cn.getDiscountPct(), BigDecimal.ZERO);
        BigDecimal discount = subTotal.multiply(discountPct).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        cn.setDiscount(discount);
        BigDecimal charges = nvl(cn.getCharges(), BigDecimal.ZERO);
        BigDecimal grand = subTotal.add(taxTotal).subtract(discount).add(charges);
        if (grand.compareTo(BigDecimal.ZERO) < 0) {
            grand = BigDecimal.ZERO;
        }
        cn.setGrandTotal(grand.setScale(2, RoundingMode.HALF_UP));
    }

    private Specification<CreditNote> buildSpecification(String search, String status, String client,
                                                         String reason, String dateFrom, String dateTo,
                                                         BigDecimal minAmount, BigDecimal maxAmount) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (search != null && !search.isBlank()) {
                String like = "%" + search.trim().toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("cnNo")), like),
                        cb.like(cb.lower(root.get("clientName")), like),
                        cb.like(cb.lower(root.get("sourceRef")), like),
                        cb.like(cb.lower(cb.toString(root.get("reason"))), like)
                ));
            }
            if (status != null && !status.isBlank()) {
                predicates.add(cb.equal(cb.lower(root.get("status")), status.trim().toLowerCase()));
            } else {
                predicates.add(cb.not(root.get("status").in("archived", "deleted")));
            }
            if (client != null && !client.isBlank()) {
                predicates.add(cb.equal(cb.lower(root.get("clientName")), client.trim().toLowerCase()));
            }
            if (reason != null && !reason.isBlank()) {
                predicates.add(cb.equal(cb.lower(root.get("reason")), reason.trim().toLowerCase()));
            }
            if (dateFrom != null && !dateFrom.isBlank()) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("cnDate"), LocalDate.parse(dateFrom).atStartOfDay()));
            }
            if (dateTo != null && !dateTo.isBlank()) {
                predicates.add(cb.lessThanOrEqualTo(root.get("cnDate"), LocalDate.parse(dateTo).atTime(23, 59, 59)));
            }
            if (minAmount != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("grandTotal"), minAmount));
            }
            if (maxAmount != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("grandTotal"), maxAmount));
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
            case "clientName", "cnDate", "grandTotal", "status", "reason", "createdAt", "updatedAt", "cnNo"
                    -> "cnNo".equals(field) ? "cnNo" : field;
            case "id" -> "cnNo";
            default -> "createdAt";
        };
        boolean asc = parts.length > 1 && "asc".equalsIgnoreCase(parts[1]);
        return Sort.by(asc ? Sort.Direction.ASC : Sort.Direction.DESC, mapped);
    }

    private long nextSequence() {
        long count = creditNoteRepository.count();
        long maxSuffix = 0;
        String prefix = "CN-" + Year.now().getValue() + "-";
        for (CreditNote cn : creditNoteRepository.findAll()) {
            String no = cn.getCnNo();
            if (no != null && no.startsWith(prefix)) {
                try {
                    maxSuffix = Math.max(maxSuffix, Long.parseLong(no.substring(prefix.length())));
                } catch (NumberFormatException ignored) {
                    // skip malformed numbers
                }
            }
        }
        return Math.max(count, maxSuffix) + 1;
    }

    private String buildNo(long sequence) {
        return String.format("CN-%d-%06d", Year.now().getValue(), sequence);
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

    private String normalizeStatus(String value) {
        String normalized = value == null ? "" : value.trim().toLowerCase().replace(" ", "_");
        return switch (normalized) {
            case "pending_approval", "pending approval" -> "pending approval";
            case "approved" -> "approved";
            case "issued" -> "issued";
            case "archived" -> "archived";
            case "deleted" -> "deleted";
            default -> "draft";
        };
    }

    private String titleCase(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        String normalized = value.replace("_", " ");
        return normalized.substring(0, 1).toUpperCase() + normalized.substring(1).toLowerCase();
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

    private BigDecimal nvl(BigDecimal value, BigDecimal fallback) {
        return value == null ? fallback : value;
    }

    private String currentUserName() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getName() != null && !"anonymousUser".equals(auth.getName())) {
            return auth.getName();
        }
        return "System";
    }

    private void addTimeline(CreditNote cn, String type, String title, String detail) {
        SalesTimeline entry = new SalesTimeline();
        entry.setModuleType(MODULE);
        entry.setModuleId(cn.getId());
        entry.setType(type);
        entry.setTitle(title);
        entry.setDetail(detail);
        timelineRepository.save(entry);
    }

    private void addTimeline(Long id, String type, String title, String detail) {
        SalesTimeline entry = new SalesTimeline();
        entry.setModuleType(MODULE);
        entry.setModuleId(id);
        entry.setType(type);
        entry.setTitle(title);
        entry.setDetail(detail);
        timelineRepository.save(entry);
    }

    private void addHistory(CreditNote cn, String field, String oldValue, String newValue, String changedBy) {
        SalesHistory entry = new SalesHistory();
        entry.setModuleType(MODULE);
        entry.setModuleId(cn.getId());
        entry.setField(field);
        entry.setOldValue(oldValue);
        entry.setNewValue(newValue);
        entry.setChangedBy(changedBy);
        historyRepository.save(entry);
    }
}
