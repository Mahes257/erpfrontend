package com.vishatech.erp.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vishatech.erp.dto.CostWorkoutAttachment;
import com.vishatech.erp.dto.CostWorkoutCategoryRequest;
import com.vishatech.erp.dto.CostWorkoutCategoryResponse;
import com.vishatech.erp.dto.CostWorkoutItemRequest;
import com.vishatech.erp.dto.CostWorkoutItemResponse;
import com.vishatech.erp.dto.CostWorkoutNextNumberResponse;
import com.vishatech.erp.dto.CostWorkoutRequest;
import com.vishatech.erp.dto.CostWorkoutResponse;
import com.vishatech.erp.dto.CostWorkoutTimelineResponse;
import com.vishatech.erp.entity.CostWorkout;
import com.vishatech.erp.entity.CostWorkoutCategory;
import com.vishatech.erp.entity.CostWorkoutItem;
import com.vishatech.erp.entity.CostWorkoutStatus;
import com.vishatech.erp.entity.CostWorkoutTimeline;
import com.vishatech.erp.entity.Cpr;
import com.vishatech.erp.entity.CprStatus;
import com.vishatech.erp.entity.CprTimeline;
import com.vishatech.erp.entity.CwMasterData;
import com.vishatech.erp.exception.BadRequestException;
import com.vishatech.erp.exception.DuplicateResourceException;
import com.vishatech.erp.exception.ResourceNotFoundException;
import com.vishatech.erp.repository.CostWorkoutRepository;
import com.vishatech.erp.repository.CprRepository;
import com.vishatech.erp.repository.CwMasterDataRepository;
import com.vishatech.erp.util.AuditContext;
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
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class CostWorkoutService {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final int MAX_REMARKS = 500;
    private static final ObjectMapper CW_JSON = new ObjectMapper();

    private final CostWorkoutRepository costWorkoutRepository;
    private final CwMasterDataRepository masterDataRepository;
    private final CprRepository cprRepository;
    private final AuditContext auditContext;

    public CostWorkoutService(CostWorkoutRepository costWorkoutRepository,
                              CwMasterDataRepository masterDataRepository,
                              CprRepository cprRepository,
                              AuditContext auditContext) {
        this.costWorkoutRepository = costWorkoutRepository;
        this.masterDataRepository = masterDataRepository;
        this.cprRepository = cprRepository;
        this.auditContext = auditContext;
    }

    // ============================== Read ==============================

    @Transactional(readOnly = true)
    public Page<CostWorkoutResponse> list(int page, int size, String search, String sort, String status,
                                          String cprRef, String customer, String company, String preparedBy,
                                          String dateFrom, String dateTo) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(size, 1), 200);
        Pageable pageable = PageRequest.of(safePage, safeSize, buildSort(sort));
        Specification<CostWorkout> spec = buildSpecification(search, status, cprRef, customer, company,
                preparedBy, dateFrom, dateTo);
        return costWorkoutRepository.findAll(spec, pageable).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public CostWorkoutResponse get(Long id) {
        return toResponse(getCw(id));
    }

    @Transactional(readOnly = true)
    public List<CostWorkoutItemResponse> getItems(Long id) {
        return getCw(id).getItems().stream().map(this::itemResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<CostWorkoutTimelineResponse> getTimeline(Long id) {
        return getCw(id).getTimeline().stream().map(this::timelineResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<CostWorkoutAttachment> getAttachments(Long id) {
        return parseAttachments(getCw(id).getAttachmentsJson());
    }

    public CostWorkoutNextNumberResponse getNextNumber() {
        long next = nextSequence();
        return new CostWorkoutNextNumberResponse(buildCwNo(next), next);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> stats() {
        long draft = costWorkoutRepository.countByStatus(CostWorkoutStatus.DRAFT);
        long completed = costWorkoutRepository.countByStatus(CostWorkoutStatus.COMPLETED);
        long submitted = costWorkoutRepository.countByStatus(CostWorkoutStatus.SUBMITTED);
        long approved = costWorkoutRepository.countByStatus(CostWorkoutStatus.APPROVED);
        long rejected = costWorkoutRepository.countByStatus(CostWorkoutStatus.REJECTED);
        long archived = costWorkoutRepository.countByStatus(CostWorkoutStatus.ARCHIVED);
        long deleted = costWorkoutRepository.countByStatus(CostWorkoutStatus.DELETED);
        long active = draft + completed + submitted + approved + rejected;
        BigDecimal totalValue = costWorkoutRepository.sumGrandTotalExcluding(
                List.of(CostWorkoutStatus.ARCHIVED, CostWorkoutStatus.DELETED));

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("total", active);
        stats.put("active", active);
        stats.put("draft", draft);
        stats.put("completed", completed);
        stats.put("submitted", submitted);
        stats.put("pending", submitted);
        stats.put("approved", approved);
        stats.put("rejected", rejected);
        stats.put("archived", archived);
        stats.put("deleted", deleted);
        stats.put("totalValue", totalValue);
        return stats;
    }

    // ============================== Write ==============================

    public CostWorkoutResponse create(CostWorkoutRequest request, boolean draft) {
        CostWorkout cw = new CostWorkout();
        if (request.cwNo() != null && !request.cwNo().isBlank()) {
            String cwNo = request.cwNo().trim();
            if (costWorkoutRepository.existsByCwNo(cwNo)) {
                throw new DuplicateResourceException("Cost Workout number already exists: " + cwNo);
            }
            cw.setCwNo(cwNo);
        } else {
            cw.setCwNo(buildCwNo(nextSequence()));
        }
        applyRequest(cw, request);
        if (draft) {
            cw.setStatus(CostWorkoutStatus.DRAFT);
        } else if (request.status() != null && !request.status().isBlank()) {
            CostWorkoutStatus parsed = parseStatus(request.status());
            cw.setStatus(parsed == CostWorkoutStatus.COMPLETED ? CostWorkoutStatus.COMPLETED : CostWorkoutStatus.DRAFT);
        } else {
            cw.setStatus(CostWorkoutStatus.DRAFT);
        }
        recalc(cw);
        cw.addTimeline(entry("created", "Cost Workout created",
                "Cost Workout '" + cw.getCwNo() + "' was created by " + currentUserName() + "."));
        CostWorkout saved = costWorkoutRepository.save(cw);
        linkCpr(saved, "created", false);
        return toResponse(saved);
    }

    public CostWorkoutResponse update(Long id, CostWorkoutRequest request) {
        CostWorkout cw = getCw(id);
        if (cw.getStatus() == CostWorkoutStatus.APPROVED || cw.getStatus() == CostWorkoutStatus.DELETED) {
            throw new BadRequestException("Cannot edit a Cost Workout in status '" + label(cw.getStatus()) + "'");
        }
        applyRequest(cw, request);
        if (request.status() != null && !request.status().isBlank()) {
            CostWorkoutStatus parsed = parseStatus(request.status());
            if (parsed == CostWorkoutStatus.COMPLETED && cw.getStatus() == CostWorkoutStatus.DRAFT) {
                cw.setStatus(CostWorkoutStatus.COMPLETED);
            } else if (parsed == CostWorkoutStatus.DRAFT) {
                cw.setStatus(CostWorkoutStatus.DRAFT);
            }
        }
        recalc(cw);
        cw.addTimeline(entry("updated", "Cost Workout updated",
                "Cost Workout details were updated by " + currentUserName() + "."));
        CostWorkout saved = costWorkoutRepository.save(cw);
        linkCpr(saved, "updated", false);
        return toResponse(saved);
    }

    public CostWorkoutResponse delete(Long id) {
        CostWorkout cw = getCw(id);
        CostWorkoutStatus previous = cw.getStatus();
        cw.setStatus(CostWorkoutStatus.DELETED);
        cw.setArchivedAt(LocalDateTime.now());
        cw.addTimeline(entry("deleted", "Cost Workout deleted",
                "Cost Workout was moved to trash by " + currentUserName() + "."));
        CostWorkout saved = costWorkoutRepository.save(cw);
        linkCpr(saved, "deleted", false);
        return toResponse(saved);
    }

    public void permanentDelete(Long id) {
        CostWorkout cw = getCw(id);
        linkCpr(cw, "permanently deleted", true);
        costWorkoutRepository.delete(cw);
    }

    public CostWorkoutResponse restore(Long id) {
        CostWorkout cw = getCw(id);
        CostWorkoutStatus previous = cw.getStatus();
        CostWorkoutStatus target = (previous == CostWorkoutStatus.DELETED || previous == CostWorkoutStatus.ARCHIVED)
                ? CostWorkoutStatus.DRAFT : previous;
        cw.setStatus(target);
        cw.setArchivedAt(null);
        cw.addTimeline(entry("restored", "Cost Workout restored",
                "Cost Workout was restored by " + currentUserName() + "."));
        CostWorkout saved = costWorkoutRepository.save(cw);
        linkCpr(saved, "restored", false);
        return toResponse(saved);
    }

    public CostWorkoutResponse archive(Long id) {
        CostWorkout cw = getCw(id);
        CostWorkoutStatus previous = cw.getStatus();
        cw.setStatus(CostWorkoutStatus.ARCHIVED);
        cw.setArchivedAt(LocalDateTime.now());
        cw.addTimeline(entry("archived", "Cost Workout archived",
                "Cost Workout was archived by " + currentUserName() + "."));
        CostWorkout saved = costWorkoutRepository.save(cw);
        linkCpr(saved, "archived", false);
        return toResponse(saved);
    }

    public CostWorkoutResponse submit(Long id) {
        CostWorkout cw = getCw(id);
        CostWorkoutStatus previous = cw.getStatus();
        if (previous == CostWorkoutStatus.SUBMITTED || previous == CostWorkoutStatus.APPROVED
                || previous == CostWorkoutStatus.ARCHIVED || previous == CostWorkoutStatus.DELETED) {
            throw new BadRequestException("Cost Workout cannot be submitted from status '" + label(previous) + "'");
        }
        cw.setStatus(CostWorkoutStatus.SUBMITTED);
        cw.addTimeline(entry("submitted", "Submitted for approval",
                "Cost Workout submitted for approval by " + currentUserName() + "."));
        CostWorkout saved = costWorkoutRepository.save(cw);
        linkCpr(saved, "submitted", false);
        return toResponse(saved);
    }

    public CostWorkoutResponse approve(Long id, String remarks) {
        CostWorkout cw = getCw(id);
        if (cw.getStatus() != CostWorkoutStatus.SUBMITTED) {
            throw new BadRequestException("Only submitted Cost Workouts can be approved (current: "
                    + label(cw.getStatus()) + ")");
        }
        cw.setStatus(CostWorkoutStatus.APPROVED);
        cw.setApprovedBy(currentUserName());
        cw.setRejectionReason(null);
        cw.addTimeline(entry("approved", "Cost Workout approved",
                "Cost Workout approved by " + currentUserName()
                        + (remarks != null && !remarks.isBlank() ? " - " + remarks : "") + "."));
        CostWorkout saved = costWorkoutRepository.save(cw);
        linkCpr(saved, "approved", false);
        return toResponse(saved);
    }

    public CostWorkoutResponse reject(Long id, String remarks) {
        CostWorkout cw = getCw(id);
        if (cw.getStatus() != CostWorkoutStatus.SUBMITTED) {
            throw new BadRequestException("Only submitted Cost Workouts can be rejected (current: "
                    + label(cw.getStatus()) + ")");
        }
        cw.setStatus(CostWorkoutStatus.REJECTED);
        cw.setApprovedBy(null);
        cw.setRejectionReason(remarks);
        cw.addTimeline(entry("rejected", "Cost Workout rejected",
                "Cost Workout rejected by " + currentUserName()
                        + (remarks != null && !remarks.isBlank() ? " - " + remarks : "") + "."));
        CostWorkout saved = costWorkoutRepository.save(cw);
        linkCpr(saved, "rejected", false);
        return toResponse(saved);
    }

    public CostWorkoutResponse duplicate(Long id) {
        CostWorkout source = getCw(id);
        CostWorkout copy = new CostWorkout();
        copy.setCwNo(buildCwNo(nextSequence()));
        copy.setCwDate(LocalDateTime.now());
        copy.setStatus(CostWorkoutStatus.DRAFT);
        copy.setPreparedBy(source.getPreparedBy());
        copy.setContactPerson(source.getContactPerson());
        copy.setDepartment(source.getDepartment());
        copy.setSourceLead(source.getSourceLead());
        copy.setCustomerName(source.getCustomerName());
        copy.setCprRef(source.getCprRef());
        copy.setCprId(source.getCprId());
        copy.setPhone(source.getPhone());
        copy.setEmail(source.getEmail());
        copy.setCompany(source.getCompany());
        copy.setGst(source.getGst());
        copy.setPan(source.getPan());
        copy.setLinkedCpr(source.getLinkedCpr());
        copy.setBillingAddress(source.getBillingAddress());
        copy.setShippingAddress(source.getShippingAddress());
        copy.setRemarks(source.getRemarks());
        copy.setAttachmentsJson(source.getAttachmentsJson());
        copy.setProfitPct(source.getProfitPct());
        copy.setDiscountPct(source.getDiscountPct());
        copy.setGstPct(source.getGstPct());
        for (CostWorkoutItem sourceItem : source.getItems()) {
            CostWorkoutItem item = new CostWorkoutItem();
            item.setDescription(sourceItem.getDescription());
            item.setQty(sourceItem.getQty());
            item.setUnit(sourceItem.getUnit());
            for (CostWorkoutCategory sourceCat : sourceItem.getCategories()) {
                CostWorkoutCategory cat = new CostWorkoutCategory();
                cat.setCategory(sourceCat.getCategory());
                cat.setQty(sourceCat.getQty());
                cat.setUnit(sourceCat.getUnit());
                cat.setRate(sourceCat.getRate());
                cat.setNotes(sourceCat.getNotes());
                item.addCategory(cat);
            }
            copy.addItem(item);
        }
        recalc(copy);
        copy.addTimeline(entry("created", "Cost Workout created",
                "Duplicated from Cost Workout '" + source.getCwNo() + "'."));
        CostWorkout saved = costWorkoutRepository.save(copy);
        linkCpr(saved, "created", false);
        return toResponse(saved);
    }

    // ============================== Master data ==============================

    public List<String> getCustomCategories() {
        return readMasterList("cw_categories");
    }

    public void saveCustomCategories(List<String> categories) {
        writeMasterList("cw_categories", categories);
    }

    public List<String> getCustomUnits() {
        return readMasterList("cw_units");
    }

    public void saveCustomUnits(List<String> units) {
        writeMasterList("cw_units", units);
    }

    // ============================== Mapping ==============================

    private CostWorkoutResponse toResponse(CostWorkout cw) {
        return new CostWorkoutResponse(
                cw.getId(),
                cw.getCwNo(),
                cw.getCwDate() == null ? null : cw.getCwDate().toLocalDate().toString(),
                statusKey(cw.getStatus()),
                cw.getPreparedBy(),
                cw.getContactPerson(),
                cw.getDepartment(),
                cw.getSourceLead(),
                cw.getCustomerName(),
                cw.getCprRef(),
                cw.getCprId(),
                cw.getPhone(),
                cw.getEmail(),
                cw.getCompany(),
                cw.getGst(),
                cw.getPan(),
                cw.getLinkedCpr(),
                cw.getBillingAddress(),
                cw.getShippingAddress(),
                cw.getRemarks(),
                cw.getProfitPct(),
                cw.getProfitAmt(),
                cw.getSellingPrice(),
                cw.getDiscountPct(),
                cw.getDiscountAmt(),
                cw.getGstPct(),
                cw.getGstAmt(),
                cw.getSubtotal(),
                cw.getGrandTotal(),
                cw.getApprovedBy(),
                cw.getRejectionReason(),
                cw.getCwDate() == null
                        ? (cw.getCreatedAt() == null ? null : cw.getCreatedAt().toLocalDate().toString())
                        : cw.getCwDate().toLocalDate().toString(),
                cw.getCreatedAt() == null ? null : cw.getCreatedAt().toString(),
                cw.getUpdatedAt() == null ? null : cw.getUpdatedAt().toString(),
                cw.getArchivedAt() == null ? null : cw.getArchivedAt().toString(),
                cw.getItems().stream().map(this::itemResponse).toList(),
                cw.getTimeline().stream().map(this::timelineResponse).toList()
        );
    }

    private CostWorkoutItemResponse itemResponse(CostWorkoutItem item) {
        return new CostWorkoutItemResponse(item.getId(), item.getDescription(), item.getQty(), item.getUnit(),
                item.getCategories().stream().map(this::categoryResponse).toList());
    }

    private CostWorkoutCategoryResponse categoryResponse(CostWorkoutCategory cat) {
        return new CostWorkoutCategoryResponse(cat.getId(), cat.getCategory(), cat.getQty(), cat.getUnit(),
                cat.getRate(), cat.getAmount(), cat.getNotes());
    }

    private CostWorkoutTimelineResponse timelineResponse(CostWorkoutTimeline entry) {
        return new CostWorkoutTimelineResponse(entry.getId(), entry.getType(), entry.getTitle(), entry.getDetail(),
                entry.getCreatedAt() == null ? null : entry.getCreatedAt().toString());
    }

    private CostWorkoutTimeline entry(String type, String title, String detail) {
        CostWorkoutTimeline entry = new CostWorkoutTimeline();
        entry.setType(type);
        entry.setTitle(title);
        entry.setDetail(detail);
        return entry;
    }

    // ============================== Helpers ==============================

    private CostWorkout getCw(Long id) {
        return costWorkoutRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Cost Workout not found with id: " + id));
    }

    /**
     * Back-link: whenever the Cost Workout changes, sync the linked CPR so it
     * carries the CW id / number / status, the cost-workout amount, and stays in
     * the 'cost workout' stage (unless already further along the workflow).
     * The CPR is resolved by the FK-style cprId column first, then by the legacy
     * cprRef / linkedCpr strings for records created before the FK existed.
     */
    private void linkCpr(CostWorkout cw, String action, boolean clear) {
        Cpr cpr = null;
        if (cw.getCprId() != null) {
            cpr = cprRepository.findById(cw.getCprId()).orElse(null);
        }
        if (cpr == null && cw.getCprRef() != null && !cw.getCprRef().isBlank()) {
            cpr = cprRepository.findByPrNo(cw.getCprRef().trim()).orElse(null);
        }
        if (cpr == null && cw.getLinkedCpr() != null && !cw.getLinkedCpr().isBlank()) {
            cpr = cprRepository.findByPrNo(cw.getLinkedCpr().trim()).orElse(null);
        }
        if (cpr == null) {
            return;
        }
        if (clear) {
            cpr.setCostWorkoutId(null);
            cpr.setCostWorkoutCwNo(null);
            cpr.setCostWorkoutStatus(null);
            cpr.addTimeline(cprTimeline("costworkout", "Cost Workout link removed",
                    "Cost Workout link removed by " + currentUserName() + "."));
        } else {
            cpr.setCostWorkoutId(cw.getId());
            cpr.setCostWorkoutCwNo(cw.getCwNo());
            cpr.setCostWorkoutStatus(statusKey(cw.getStatus()));
            cpr.setCostWorkout(cw.getSubtotal());
            CprStatus previousStatus = cpr.getStatus();
            if (cpr.getStatus() == CprStatus.DRAFT || cpr.getStatus() == CprStatus.COST_WORKOUT) {
                cpr.setStatus(CprStatus.COST_WORKOUT);
                cpr.setCurrentStage("Cost Workout");
            }
            cpr.addTimeline(cprFieldTimeline("costworkout", "Cost Workout " + action,
                    "Cost Workout " + cw.getCwNo() + " " + action + " by " + currentUserName() + ".",
                    "Cost Workout", label(previousStatus), label(cpr.getStatus())));
        }
        cprRepository.save(cpr);
    }

    private CprTimeline cprFieldTimeline(String type, String title, String detail,
                                         String field, String oldValue, String newValue) {
        CprTimeline entry = cprTimeline(type, title, detail);
        entry.setField(field);
        entry.setOldValue(oldValue);
        entry.setNewValue(newValue);
        return entry;
    }

    private CprTimeline cprTimeline(String type, String title, String detail) {
        CprTimeline entry = new CprTimeline();
        entry.setType(type);
        entry.setTitle(title);
        entry.setDetail(detail);
        entry.setUserId(auditContext.currentUserId());
        entry.setUserName(auditContext.currentUserName());
        entry.setUserRole(auditContext.currentUserRole());
        entry.setIpAddress(auditContext.ipAddress());
        String device = auditContext.deviceInfo();
        entry.setDeviceInfo(device != null && device.length() > 500 ? device.substring(0, 500) : device);
        return entry;
    }

    private void applyRequest(CostWorkout cw, CostWorkoutRequest request) {
        LocalDateTime cwDate = parseDate(request.cwDate());
        if (cwDate == null) {
            throw new BadRequestException("Date is required");
        }
        cw.setCwDate(cwDate);
        if (request.preparedBy() == null || request.preparedBy().isBlank()) {
            throw new BadRequestException("Prepared By is required");
        }
        if (request.department() == null || request.department().isBlank()) {
            throw new BadRequestException("Department is required");
        }
        if (request.sourceLead() == null || request.sourceLead().isBlank()) {
            throw new BadRequestException("Please select a Lead or Client");
        }
        if (request.remarks() != null && request.remarks().length() > MAX_REMARKS) {
            throw new BadRequestException("Remarks exceed maximum length of " + MAX_REMARKS + " characters");
        }
        cw.setPreparedBy(request.preparedBy().trim());
        cw.setDepartment(request.department().trim());
        cw.setSourceLead(request.sourceLead().trim());
        cw.setContactPerson(request.contactPerson());
        cw.setCustomerName(request.customerName());
        cw.setCprRef(request.cprRef());
        // Only update the CPR link when the payload actually carries a cprId;
        // a null on edit preserves the existing FK instead of silently dropping it.
        if (request.cprId() != null) {
            cw.setCprId(request.cprId());
        }
        cw.setPhone(request.phone());
        cw.setEmail(request.email());
        cw.setCompany(request.company());
        cw.setGst(request.gst());
        cw.setPan(request.pan());
        cw.setLinkedCpr(request.linkedCpr());
        cw.setBillingAddress(request.billingAddress());
        cw.setShippingAddress(request.shippingAddress());
        cw.setRemarks(request.remarks());
        cw.setProfitPct(pct(request.profitPct(), "Profit %"));
        cw.setDiscountPct(pct(request.discountPct(), "Discount %"));
        cw.setGstPct(pct(request.gstPct(), "GST %"));
        // Only overwrite stored attachments when the payload actually carries
        // them (empty/missing payload preserves existing files on edit).
        if (request.attachments() != null) {
            cw.setAttachmentsJson(serializeAttachments(request.attachments()));
        }

        cw.getItems().clear();
        boolean hasContent = false;
        if (request.items() != null) {
            for (CostWorkoutItemRequest itemRequest : request.items()) {
                if (itemRequest == null) {
                    continue;
                }
                CostWorkoutItem item = new CostWorkoutItem();
                item.setDescription(itemRequest.description());
                item.setQty(itemRequest.qty() == null ? BigDecimal.ONE : itemRequest.qty());
                item.setUnit(itemRequest.unit());
                boolean itemHasContent = false;
                if (itemRequest.categories() != null) {
                    for (CostWorkoutCategoryRequest catRequest : itemRequest.categories()) {
                        if (catRequest == null) {
                            continue;
                        }
                        BigDecimal qty = catRequest.qty() == null ? BigDecimal.ZERO : catRequest.qty();
                        BigDecimal rate = catRequest.rate() == null ? BigDecimal.ZERO : catRequest.rate();
                        if (qty.compareTo(BigDecimal.ZERO) < 0 || rate.compareTo(BigDecimal.ZERO) < 0) {
                            throw new BadRequestException("Quantity and Rate cannot be negative");
                        }
                        CostWorkoutCategory cat = new CostWorkoutCategory();
                        cat.setCategory(catRequest.category());
                        cat.setQty(qty);
                        cat.setUnit(catRequest.unit());
                        cat.setRate(rate);
                        cat.setNotes(catRequest.notes());
                        item.addCategory(cat);
                        if (qty.compareTo(BigDecimal.ZERO) > 0 || rate.compareTo(BigDecimal.ZERO) > 0
                                || (catRequest.category() != null
                                && "lead time".equalsIgnoreCase(catRequest.category().trim()))) {
                            itemHasContent = true;
                        }
                    }
                }
                if (itemHasContent || (itemRequest.description() != null && !itemRequest.description().isBlank())) {
                    hasContent = true;
                }
                cw.addItem(item);
            }
        }
        if (!hasContent) {
            throw new BadRequestException("Add at least one cost item with a description or quantity/rate");
        }
    }

    private BigDecimal pct(BigDecimal value, String field) {
        BigDecimal v = value == null ? BigDecimal.ZERO : value;
        if (v.compareTo(BigDecimal.ZERO) < 0 || v.compareTo(BigDecimal.valueOf(100)) > 0) {
            throw new BadRequestException(field + " must be between 0 and 100");
        }
        return v.setScale(2, RoundingMode.HALF_UP);
    }

    private void recalc(CostWorkout cw) {
        BigDecimal subtotal = BigDecimal.ZERO;
        for (CostWorkoutItem item : cw.getItems()) {
            BigDecimal itemTotal = BigDecimal.ZERO;
            for (CostWorkoutCategory cat : item.getCategories()) {
                boolean leadTime = cat.getCategory() != null
                        && "lead time".equalsIgnoreCase(cat.getCategory().trim());
                BigDecimal amount = leadTime
                        ? BigDecimal.ZERO
                        : (cat.getQty() == null ? BigDecimal.ZERO : cat.getQty())
                        .multiply(cat.getRate() == null ? BigDecimal.ZERO : cat.getRate());
                cat.setAmount(amount);
                if (!leadTime) {
                    itemTotal = itemTotal.add(amount);
                }
            }
            subtotal = subtotal.add(itemTotal);
        }
        BigDecimal profitPct = cw.getProfitPct() == null ? BigDecimal.ZERO : cw.getProfitPct();
        BigDecimal discountPct = cw.getDiscountPct() == null ? BigDecimal.ZERO : cw.getDiscountPct();
        BigDecimal gstPct = cw.getGstPct() == null ? BigDecimal.valueOf(18) : cw.getGstPct();

        BigDecimal profitAmt = subtotal.multiply(profitPct).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        BigDecimal sellingPrice = subtotal.add(profitAmt);
        BigDecimal discountAmt = sellingPrice.multiply(discountPct).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        BigDecimal afterDiscount = sellingPrice.subtract(discountAmt);
        BigDecimal gstAmt = afterDiscount.multiply(gstPct).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        BigDecimal grandTotal = afterDiscount.add(gstAmt);

        cw.setSubtotal(subtotal.setScale(2, RoundingMode.HALF_UP));
        cw.setProfitAmt(profitAmt);
        cw.setSellingPrice(sellingPrice);
        cw.setDiscountAmt(discountAmt);
        cw.setGstAmt(gstAmt);
        cw.setGrandTotal(grandTotal);
    }

    private Specification<CostWorkout> buildSpecification(String search, String status, String cprRef, String customer,
                                                          String company, String preparedBy, String dateFrom, String dateTo) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (search != null && !search.isBlank()) {
                String like = "%" + search.trim().toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("cwNo")), like),
                        cb.like(cb.lower(root.get("cprRef")), like),
                        cb.like(cb.lower(root.get("customerName")), like),
                        cb.like(cb.lower(root.get("company")), like),
                        cb.like(cb.lower(root.get("preparedBy")), like),
                        cb.like(cb.lower(root.get("linkedCpr")), like)
                ));
            }
            if (status != null && !status.isBlank()) {
                predicates.add(cb.equal(root.get("status"), parseStatus(status)));
            } else {
                predicates.add(cb.not(root.get("status").in(CostWorkoutStatus.ARCHIVED, CostWorkoutStatus.DELETED)));
            }
            if (cprRef != null && !cprRef.isBlank()) {
                predicates.add(cb.like(cb.lower(root.get("cprRef")), "%" + cprRef.trim().toLowerCase() + "%"));
            }
            if (customer != null && !customer.isBlank()) {
                predicates.add(cb.like(cb.lower(root.get("customerName")), "%" + customer.trim().toLowerCase() + "%"));
            }
            if (company != null && !company.isBlank()) {
                predicates.add(cb.like(cb.lower(root.get("company")), "%" + company.trim().toLowerCase() + "%"));
            }
            if (preparedBy != null && !preparedBy.isBlank()) {
                predicates.add(cb.like(cb.lower(root.get("preparedBy")), "%" + preparedBy.trim().toLowerCase() + "%"));
            }
            if (dateFrom != null && !dateFrom.isBlank()) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("cwDate"), LocalDate.parse(dateFrom).atStartOfDay()));
            }
            if (dateTo != null && !dateTo.isBlank()) {
                predicates.add(cb.lessThanOrEqualTo(root.get("cwDate"), LocalDate.parse(dateTo).atTime(23, 59, 59)));
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
            case "date", "cwDate" -> "cwDate";
            case "customer", "customerName" -> "customerName";
            case "company", "companyName" -> "company";
            case "cwNo", "cprRef", "preparedBy", "subtotal", "profitPct", "sellingPrice", "status",
                 "createdAt", "updatedAt", "grandTotal" -> field;
            default -> "createdAt";
        };
        boolean asc = parts.length > 1 && "asc".equalsIgnoreCase(parts[1]);
        return Sort.by(asc ? Sort.Direction.ASC : Sort.Direction.DESC, mapped);
    }

    private long nextSequence() {
        long count = costWorkoutRepository.count();
        List<CostWorkout> all = costWorkoutRepository.findAll();
        long maxSuffix = 0;
        String prefix = "CW-" + Year.now().getValue() + "-";
        for (CostWorkout cw : all) {
            String cwNo = cw.getCwNo();
            if (cwNo != null && cwNo.startsWith(prefix)) {
                try {
                    maxSuffix = Math.max(maxSuffix, Long.parseLong(cwNo.substring(prefix.length())));
                } catch (NumberFormatException ignored) {
                    // skip malformed numbers
                }
            }
        }
        return Math.max(count, maxSuffix) + 1;
    }

    private String buildCwNo(long sequence) {
        return String.format("CW-%d-%06d", Year.now().getValue(), sequence);
    }

    private String serializeAttachments(List<CostWorkoutAttachment> attachments) {
        if (attachments == null || attachments.isEmpty()) {
            return null;
        }
        try {
            return CW_JSON.writeValueAsString(attachments);
        } catch (Exception e) {
            return null;
        }
    }

    private List<CostWorkoutAttachment> parseAttachments(String json) {
        if (json == null || json.isBlank()) {
            return new ArrayList<>();
        }
        try {
            List<CostWorkoutAttachment> list = CW_JSON.readValue(json, new TypeReference<List<CostWorkoutAttachment>>() {
            });
            return list == null ? new ArrayList<>() : list;
        } catch (Exception e) {
            return new ArrayList<>();
        }
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

    private CostWorkoutStatus parseStatus(String value) {
        String normalized = value.trim().toUpperCase().replace(" ", "_").replace("-", "_");
        if ("PENDING".equals(normalized) || "UNDER_REVIEW".equals(normalized) || "SUBMITTED".equals(normalized)) {
            return CostWorkoutStatus.SUBMITTED;
        }
        try {
            return CostWorkoutStatus.valueOf(normalized);
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Invalid status: " + value);
        }
    }

    private String statusKey(CostWorkoutStatus status) {
        if (status == null) {
            return "draft";
        }
        return switch (status) {
            case COMPLETED -> "completed";
            case SUBMITTED -> "submitted";
            case APPROVED -> "approved";
            case REJECTED -> "rejected";
            case ARCHIVED -> "archived";
            case DELETED -> "deleted";
            default -> "draft";
        };
    }

    private String label(Enum<?> value) {
        if (value == null) {
            return null;
        }
        return value.name().substring(0, 1) + value.name().substring(1).toLowerCase().replace("_", " ");
    }

    private List<String> readMasterList(String key) {
        var opt = masterDataRepository.findByDataKey(key);
        if (opt.isEmpty()) {
            return new ArrayList<>();
        }
        String value = opt.get().getValue();
        return (value == null || value.isBlank()) ? new ArrayList<>() : parseJsonList(value);
    }

    private void writeMasterList(String key, List<String> values) {
        List<String> clean = values == null ? List.of() : values.stream()
                .filter(v -> v != null && !v.isBlank())
                .map(String::trim)
                .distinct()
                .toList();
        CwMasterData data = masterDataRepository.findByDataKey(key).orElseGet(() -> {
            CwMasterData d = new CwMasterData();
            d.setDataKey(key);
            return d;
        });
        data.setValue(toJsonArray(clean));
        masterDataRepository.save(data);
    }

    private List<String> parseJsonList(String json) {
        List<String> result = new ArrayList<>();
        try {
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            if (mapper.readTree(json).isArray()) {
                mapper.readTree(json).forEach(node -> result.add(node.asText()));
            }
        } catch (Exception ignored) {
            // fall back to empty list
        }
        return result;
    }

    private String toJsonArray(List<String> values) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < values.size(); i++) {
            if (i > 0) {
                sb.append(',');
            }
            sb.append('"').append(values.get(i).replace("\"", "\\\"")).append('"');
        }
        sb.append(']');
        return sb.toString();
    }

    private String currentUserName() {
        return auditContext.currentUserName();
    }
}
