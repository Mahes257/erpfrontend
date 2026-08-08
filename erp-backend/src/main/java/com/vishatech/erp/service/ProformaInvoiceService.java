package com.vishatech.erp.service;

import com.vishatech.erp.dto.InvoiceItemRequest;
import com.vishatech.erp.dto.ProformaInvoiceItemRequest;
import com.vishatech.erp.dto.ProformaInvoiceItemResponse;
import com.vishatech.erp.dto.ProformaInvoiceNextNumberResponse;
import com.vishatech.erp.dto.ProformaInvoiceRequest;
import com.vishatech.erp.dto.ProformaInvoiceResponse;
import com.vishatech.erp.dto.SalesAttachmentResponse;
import com.vishatech.erp.dto.SalesHistoryResponse;
import com.vishatech.erp.dto.SalesTimelineResponse;
import com.vishatech.erp.entity.DeliveryChallan;
import com.vishatech.erp.entity.DeliveryChallanItem;
import com.vishatech.erp.entity.Invoice;
import com.vishatech.erp.entity.InvoiceItem;
import com.vishatech.erp.entity.ProformaInvoice;
import com.vishatech.erp.entity.ProformaInvoiceItem;
import com.vishatech.erp.entity.SalesAttachment;
import com.vishatech.erp.entity.SalesHistory;
import com.vishatech.erp.entity.SalesOrder;
import com.vishatech.erp.entity.SalesOrderItem;
import com.vishatech.erp.entity.SalesTimeline;
import com.vishatech.erp.exception.BadRequestException;
import com.vishatech.erp.exception.ResourceNotFoundException;
import com.vishatech.erp.repository.DeliveryChallanRepository;
import com.vishatech.erp.repository.InvoiceRepository;
import com.vishatech.erp.repository.ProformaInvoiceRepository;
import com.vishatech.erp.repository.SalesOrderRepository;
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
public class ProformaInvoiceService {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final String MODULE = "proforma-invoice";

    private final ProformaInvoiceRepository proformaInvoiceRepository;
    private final SalesOrderRepository salesOrderRepository;
    private final DeliveryChallanRepository deliveryChallanRepository;
    private final SalesTimelineRepository timelineRepository;
    private final SalesHistoryRepository historyRepository;
    private final SalesAttachmentRepository attachmentRepository;
    private final InvoiceRepository invoiceRepository;
    private final FileStorageService fileStorageService;
    private final String baseUrl;

    public ProformaInvoiceService(ProformaInvoiceRepository proformaInvoiceRepository,
                                  SalesOrderRepository salesOrderRepository,
                                  DeliveryChallanRepository deliveryChallanRepository,
                                  SalesTimelineRepository timelineRepository,
                                  SalesHistoryRepository historyRepository,
                                  SalesAttachmentRepository attachmentRepository,
                                  InvoiceRepository invoiceRepository,
                                  FileStorageService fileStorageService,
                                  @Value("${app.base-url:http://localhost:8080}") String baseUrl) {
        this.proformaInvoiceRepository = proformaInvoiceRepository;
        this.salesOrderRepository = salesOrderRepository;
        this.deliveryChallanRepository = deliveryChallanRepository;
        this.timelineRepository = timelineRepository;
        this.historyRepository = historyRepository;
        this.attachmentRepository = attachmentRepository;
        this.invoiceRepository = invoiceRepository;
        this.fileStorageService = fileStorageService;
        this.baseUrl = baseUrl;
    }

    public Page<ProformaInvoiceResponse> list(int page, int size, String search, String sort,
                                              String status, String client, String dateFrom, String dateTo,
                                              BigDecimal minAmount, BigDecimal maxAmount) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(size, 1), 200);
        Pageable pageable = PageRequest.of(safePage, safeSize, buildSort(sort));
        Specification<ProformaInvoice> spec = buildSpecification(search, status, client, dateFrom, dateTo, minAmount, maxAmount);
        return proformaInvoiceRepository.findAll(spec, pageable).map(this::toResponse);
    }

    public ProformaInvoiceResponse get(Long id) {
        return toResponse(getPi(id));
    }

    public ProformaInvoiceNextNumberResponse getNextNumber() {
        long next = nextSequence();
        return new ProformaInvoiceNextNumberResponse(buildNo(next), next);
    }

    public Map<String, Object> stats() {
        List<String> excluded = List.of("archived", "deleted");
        Map<String, Object> stats = new LinkedHashMap<>();
        long active = 0;
        for (String status : List.of("draft", "sent", "paid", "overdue", "accepted", "expired", "converted", "cancelled")) {
            long count = proformaInvoiceRepository.countByStatus(status);
            stats.put(status.replace(" ", ""), count);
            active += count;
        }
        stats.put("total", active);
        stats.put("active", active);
        stats.put("archived", proformaInvoiceRepository.countByStatus("archived"));
        stats.put("deleted", proformaInvoiceRepository.countByStatus("deleted"));
        stats.put("totalAmt", proformaInvoiceRepository.sumGrandTotalExcluding(excluded));
        return stats;
    }

    public ProformaInvoiceResponse create(ProformaInvoiceRequest request, boolean draft) {
        ProformaInvoice pi = new ProformaInvoice();
        if (request.piNo() != null && !request.piNo().isBlank()) {
            if (proformaInvoiceRepository.existsByPiNo(request.piNo().trim())) {
                throw new BadRequestException("Proforma Invoice number already exists: " + request.piNo());
            }
            pi.setPiNo(request.piNo().trim());
        } else {
            pi.setPiNo(buildNo(nextSequence()));
        }
        applyRequest(pi, request);
        if (draft) {
            pi.setStatus("draft");
        } else if (request.status() != null && !request.status().isBlank()) {
            pi.setStatus(normalizeStatus(request.status()));
        } else {
            pi.setStatus("draft");
        }
        recalcTotals(pi);
        // Persist first so the generated id is available for timeline/history rows
        // (their module_id column is NOT NULL).
        ProformaInvoice saved = proformaInvoiceRepository.saveAndFlush(pi);
        addTimeline(saved, "created", "Proforma Invoice created",
                "Proforma Invoice '" + saved.getPiNo() + "' was created.");
        addHistory(saved, "Proforma Invoice", null, saved.getPiNo(), currentUserName());
        return toResponse(saved);
    }

    public ProformaInvoiceResponse update(Long id, ProformaInvoiceRequest request) {
        ProformaInvoice pi = getPi(id);
        applyRequest(pi, request);
        if (request.status() != null && !request.status().isBlank()) {
            pi.setStatus(normalizeStatus(request.status()));
        }
        recalcTotals(pi);
        addTimeline(pi, "updated", "Proforma Invoice updated",
                "Proforma Invoice details were updated by " + currentUserName() + ".");
        return toResponse(proformaInvoiceRepository.save(pi));
    }

    public ProformaInvoiceResponse delete(Long id) {
        ProformaInvoice pi = getPi(id);
        pi.setStatus("deleted");
        pi.setArchivedAt(LocalDateTime.now());
        addTimeline(pi, "deleted", "Proforma Invoice deleted",
                "Proforma Invoice was moved to trash by " + currentUserName() + ".");
        addHistory(pi, "Status", null, "Deleted", currentUserName());
        return toResponse(proformaInvoiceRepository.save(pi));
    }

    public ProformaInvoiceResponse restore(Long id) {
        ProformaInvoice pi = getPi(id);
        String previous = pi.getStatus();
        String target = ("deleted".equals(previous) || "archived".equals(previous)) ? "draft" : previous;
        pi.setStatus(target);
        pi.setArchivedAt(null);
        addTimeline(pi, "restored", "Proforma Invoice restored",
                "Proforma Invoice was restored by " + currentUserName() + ".");
        addHistory(pi, "Status", titleCase(previous), titleCase(target), currentUserName());
        return toResponse(proformaInvoiceRepository.save(pi));
    }

    public ProformaInvoiceResponse archive(Long id) {
        ProformaInvoice pi = getPi(id);
        pi.setStatus("archived");
        pi.setArchivedAt(LocalDateTime.now());
        addTimeline(pi, "archived", "Proforma Invoice archived",
                "Proforma Invoice was archived by " + currentUserName() + ".");
        addHistory(pi, "Status", null, "Archived", currentUserName());
        return toResponse(proformaInvoiceRepository.save(pi));
    }

    public ProformaInvoiceResponse changeStatus(Long id, String status) {
        ProformaInvoice pi = getPi(id);
        String normalized = normalizeStatus(status);
        if ("deleted".equals(pi.getStatus())) {
            throw new BadRequestException("Cannot change status of a deleted Proforma Invoice");
        }
        pi.setStatus(normalized);
        addTimeline(pi, "status", "Status changed",
                "Status changed to '" + titleCase(normalized) + "' by " + currentUserName() + ".");
        addHistory(pi, "Status", null, titleCase(normalized), currentUserName());
        return toResponse(proformaInvoiceRepository.save(pi));
    }

    public ProformaInvoiceResponse send(Long id) {
        ProformaInvoice pi = getPi(id);
        if ("draft".equals(pi.getStatus())) {
            pi.setStatus("sent");
            addTimeline(pi, "sent", "Proforma Invoice sent",
                    "Proforma Invoice sent to " + (pi.getEmail() == null ? "client" : pi.getEmail()) + ".");
            addHistory(pi, "Status", "Draft", "Sent", currentUserName());
        }
        return toResponse(proformaInvoiceRepository.save(pi));
    }

    public ProformaInvoiceResponse duplicate(Long id) {
        ProformaInvoice source = getPi(id);
        ProformaInvoice copy = new ProformaInvoice();
        copy.setPiNo(buildNo(nextSequence()));
        copy.setReferenceNo(source.getReferenceNo());
        copy.setSource(source.getSource());
        copy.setSourceRef(source.getSourceRef());
        copy.setClientId(source.getClientId());
        copy.setClientName(source.getClientName());
        copy.setContactPerson(source.getContactPerson());
        copy.setGstin(source.getGstin());
        copy.setPan(source.getPan());
        copy.setEmail(source.getEmail());
        copy.setPhone(source.getPhone());
        copy.setBillingAddress(source.getBillingAddress());
        copy.setShippingAddress(source.getShippingAddress());
        copy.setBankName(source.getBankName());
        copy.setBankAccount(source.getBankAccount());
        copy.setBankIfsc(source.getBankIfsc());
        copy.setBankBranch(source.getBankBranch());
        copy.setBankType(source.getBankType());
        copy.setBankUpi(source.getBankUpi());
        copy.setTerms(source.getTerms());
        copy.setNotes(source.getNotes());
        copy.setCharges(source.getCharges());
        copy.setDiscount(source.getDiscount());
        copy.setDiscountPct(source.getDiscountPct());
        copy.setValidTill(source.getValidTill());
        copy.setShipSameAsBill(source.isShipSameAsBill());
        copy.setStatus("draft");
        copy.setPiDate(LocalDateTime.now());
        for (ProformaInvoiceItem sourceItem : source.getItems()) {
            ProformaInvoiceItem item = new ProformaInvoiceItem();
            copyItem(item, sourceItem);
            copy.addItem(item);
        }
        recalcTotals(copy);
        // Persist first so the generated id is available for timeline/history rows
        // (their module_id column is NOT NULL).
        ProformaInvoice saved = proformaInvoiceRepository.saveAndFlush(copy);
        addTimeline(saved, "created", "Proforma Invoice created",
                "Duplicated from Proforma Invoice '" + source.getPiNo() + "'.");
        addHistory(saved, "Proforma Invoice", null, saved.getPiNo(), currentUserName());
        return toResponse(saved);
    }

    public int bulkArchive(List<Long> ids) {
        int count = 0;
        for (Long id : ids) {
            ProformaInvoice pi = getPi(id);
            if (!"archived".equals(pi.getStatus()) && !"deleted".equals(pi.getStatus())) {
                pi.setStatus("archived");
                pi.setArchivedAt(LocalDateTime.now());
                addTimeline(pi, "archived", "Proforma Invoice archived",
                        "Proforma Invoice was archived by " + currentUserName() + ".");
                proformaInvoiceRepository.save(pi);
                count++;
            }
        }
        return count;
    }

    public int bulkRestore(List<Long> ids) {
        int count = 0;
        for (Long id : ids) {
            ProformaInvoice pi = getPi(id);
            if ("archived".equals(pi.getStatus()) || "deleted".equals(pi.getStatus())) {
                pi.setStatus("draft");
                pi.setArchivedAt(null);
                addTimeline(pi, "restored", "Proforma Invoice restored",
                        "Proforma Invoice was restored by " + currentUserName() + ".");
                proformaInvoiceRepository.save(pi);
                count++;
            }
        }
        return count;
    }

    public int bulkDelete(List<Long> ids) {
        List<ProformaInvoice> pis = proformaInvoiceRepository.findAllById(ids);
        proformaInvoiceRepository.deleteAll(pis);
        return pis.size();
    }

    /** Proforma Invoice → Sales Order conversion (ERP: Convert to Sales Order). */
    public ProformaInvoiceResponse convertToSalesOrder(Long id) {
        ProformaInvoice pi = getPi(id);
        if (pi.getConvertedToSo() != null && !pi.getConvertedToSo().isBlank()) {
            throw new BadRequestException("Proforma Invoice already converted to " + pi.getConvertedToSo());
        }
        SalesOrder so = new SalesOrder();
        so.setSoNo(buildSoNumber());
        so.setOrderDate(LocalDateTime.now());
        so.setStatus("draft");
        so.setQtnRef(pi.getPiNo());
        so.setClientId(pi.getClientId());
        so.setClientName(pi.getClientName());
        so.setContactPerson(pi.getContactPerson());
        so.setEmail(pi.getEmail());
        so.setPhone(pi.getPhone());
        so.setBillingAddress(pi.getBillingAddress());
        so.setShippingAddress(pi.getShippingAddress());
        so.setGstin(pi.getGstin());
        so.setPan(pi.getPan());
        so.setTerms(pi.getTerms());
        so.setRemarks(pi.getNotes());
        for (ProformaInvoiceItem sourceItem : pi.getItems()) {
            SalesOrderItem item = new SalesOrderItem();
            item.setDescription(sourceItem.getDescription());
            item.setSku(sourceItem.getSku());
            item.setHsn(sourceItem.getHsn());
            item.setUom(sourceItem.getUom());
            item.setQty(sourceItem.getQty());
            item.setRate(sourceItem.getRate());
            item.setDiscountPct(sourceItem.getDiscountPct());
            item.setGstRate(sourceItem.getGstRate());
            so.addItem(item);
        }
        so.setSubTotal(pi.getSubTotal());
        so.setDiscount(pi.getDiscount());
        so.setDiscountPct(pi.getDiscountPct());
        so.setCgstTotal(pi.getCgstTotal());
        so.setSgstTotal(pi.getSgstTotal());
        so.setTaxTotal(pi.getTaxTotal());
        so.setCharges(pi.getCharges());
        so.setGrandTotal(pi.getGrandTotal());
        salesOrderRepository.save(so);

        pi.setStatus("converted");
        pi.setConvertedToSo(so.getSoNo());
        addTimeline(pi, "converted", "Converted to Sales Order",
                "Proforma Invoice converted to Sales Order " + so.getSoNo() + ".");
        addHistory(pi, "Status", null, "Converted", currentUserName());
        return toResponse(proformaInvoiceRepository.save(pi));
    }

    /** Proforma Invoice → Delivery Challan conversion (ERP: Generate Delivery Challan). */
    public ProformaInvoiceResponse generateDeliveryChallan(Long id) {
        ProformaInvoice pi = getPi(id);
        if (pi.getConvertedToDc() != null && !pi.getConvertedToDc().isBlank()) {
            throw new BadRequestException("Proforma Invoice already converted to " + pi.getConvertedToDc());
        }
        DeliveryChallan dc = new DeliveryChallan();
        dc.setDcNo(buildDcNumber());
        dc.setDcDate(LocalDateTime.now());
        dc.setStatus("draft");
        dc.setSoRef(pi.getSourceRef());
        dc.setScRef(pi.getReferenceNo());
        dc.setClientId(pi.getClientId());
        dc.setClientName(pi.getClientName());
        dc.setContactPerson(pi.getContactPerson());
        dc.setEmail(pi.getEmail());
        dc.setPhone(pi.getPhone());
        dc.setBillingAddress(pi.getBillingAddress());
        dc.setShippingAddress(pi.getShippingAddress());
        dc.setNotes(pi.getNotes());
        dc.setTerms(pi.getTerms());
        for (ProformaInvoiceItem sourceItem : pi.getItems()) {
            DeliveryChallanItem item = new DeliveryChallanItem();
            item.setDescription(sourceItem.getDescription());
            item.setSku(sourceItem.getSku());
            item.setHsn(sourceItem.getHsn());
            item.setUom(sourceItem.getUom());
            item.setQty(sourceItem.getQty());
            item.setRate(sourceItem.getRate());
            item.setDiscountPct(sourceItem.getDiscountPct());
            item.setGstRate(sourceItem.getGstRate());
            dc.addItem(item);
        }
        dc.setSubTotal(pi.getSubTotal());
        dc.setDiscount(pi.getDiscount());
        dc.setDiscountPct(pi.getDiscountPct());
        dc.setCgstTotal(pi.getCgstTotal());
        dc.setSgstTotal(pi.getSgstTotal());
        dc.setTaxTotal(pi.getTaxTotal());
        dc.setCharges(pi.getCharges());
        dc.setGrandTotal(pi.getGrandTotal());
        deliveryChallanRepository.save(dc);

        pi.setStatus("converted");
        pi.setConvertedToDc(dc.getDcNo());
        addTimeline(pi, "converted", "Delivery Challan generated",
                "Delivery Challan " + dc.getDcNo() + " was generated from this Proforma Invoice.");
        addHistory(pi, "Status", null, "Converted", currentUserName());
        return toResponse(proformaInvoiceRepository.save(pi));
    }

    /** Proforma Invoice → Invoice conversion. */
    public ProformaInvoiceResponse convertToInvoice(Long id) {
        ProformaInvoice pi = getPi(id);
        if (pi.getConvertedToInvoice() != null && !pi.getConvertedToInvoice().isBlank()) {
            throw new BadRequestException("Proforma Invoice already converted to " + pi.getConvertedToInvoice());
        }
        Invoice invoice = new Invoice();
        invoice.setInvoiceNo(buildInvoiceNumber());
        invoice.setInvoiceDate(LocalDateTime.now());
        invoice.setStatus("draft");
        invoice.setSource("pi");
        invoice.setSourceRef(pi.getPiNo());
        invoice.setClientId(pi.getClientId());
        invoice.setClientName(pi.getClientName());
        invoice.setContactPerson(pi.getContactPerson());
        invoice.setEmail(pi.getEmail());
        invoice.setPhone(pi.getPhone());
        invoice.setGstin(pi.getGstin());
        invoice.setPan(pi.getPan());
        invoice.setBillingAddress(pi.getBillingAddress());
        invoice.setShippingAddress(pi.getShippingAddress());
        invoice.setBankName(pi.getBankName());
        invoice.setBankAccount(pi.getBankAccount());
        invoice.setBankIfsc(pi.getBankIfsc());
        invoice.setBankBranch(pi.getBankBranch());
        invoice.setBankType(pi.getBankType());
        invoice.setBankUpi(pi.getBankUpi());
        invoice.setTerms(pi.getTerms());
        invoice.setNotes(pi.getNotes());
        for (ProformaInvoiceItem sourceItem : pi.getItems()) {
            InvoiceItem item = new InvoiceItem();
            item.setDescription(sourceItem.getDescription());
            item.setSku(sourceItem.getSku());
            item.setHsn(sourceItem.getHsn());
            item.setUom(sourceItem.getUom());
            item.setQty(sourceItem.getQty());
            item.setRate(sourceItem.getRate());
            item.setDiscountPct(sourceItem.getDiscountPct());
            item.setGstRate(sourceItem.getGstRate());
            invoice.addItem(item);
        }
        invoice.setSubTotal(pi.getSubTotal());
        invoice.setDiscount(pi.getDiscount());
        invoice.setDiscountPct(pi.getDiscountPct());
        invoice.setTaxTotal(pi.getTaxTotal());
        invoice.setCgstTotal(pi.getCgstTotal());
        invoice.setSgstTotal(pi.getSgstTotal());
        invoice.setCharges(pi.getCharges());
        invoice.setGrandTotal(pi.getGrandTotal());
        invoiceRepository.save(invoice);

        pi.setStatus("converted");
        pi.setConvertedToInvoice(invoice.getInvoiceNo());
        addTimeline(pi, "converted", "Converted to Invoice",
                "Proforma Invoice converted to Invoice " + invoice.getInvoiceNo() + ".");
        addHistory(pi, "Status", null, "Converted", currentUserName());
        return toResponse(proformaInvoiceRepository.save(pi));
    }

    public List<ProformaInvoiceResponse> export(String search, String status, String client,
                                                String dateFrom, String dateTo,
                                                BigDecimal minAmount, BigDecimal maxAmount) {
        Specification<ProformaInvoice> spec = buildSpecification(search, status, client, dateFrom, dateTo, minAmount, maxAmount);
        return proformaInvoiceRepository.findAll(spec).stream().map(this::toResponse).toList();
    }

    public String buildCsv(List<ProformaInvoiceResponse> pis) {
        StringBuilder sb = new StringBuilder();
        sb.append("PI No,Date,Client,Reference,Status,Items,Amount,Created\n");
        for (ProformaInvoiceResponse p : pis) {
            sb.append(escapeCsv(p.piNo())).append(',')
              .append(escapeCsv(p.date())).append(',')
              .append(escapeCsv(p.clientName())).append(',')
              .append(escapeCsv(p.referenceNo())).append(',')
              .append(escapeCsv(p.status())).append(',')
              .append(p.itemsCount() == null ? "" : p.itemsCount()).append(',')
              .append(p.grandTotal() == null ? "" : p.grandTotal().toPlainString()).append(',')
              .append(escapeCsv(p.createdAt())).append('\n');
        }
        return sb.toString();
    }

    public List<SalesTimelineResponse> getTimeline(Long id) {
        getPi(id);
        return timelineRepository.findByModuleTypeAndModuleIdOrderByCreatedAtAsc(MODULE, id)
                .stream().map(this::timelineResponse).toList();
    }

    public List<SalesHistoryResponse> getHistory(Long id) {
        getPi(id);
        return historyRepository.findByModuleTypeAndModuleIdOrderByCreatedAtAsc(MODULE, id)
                .stream().map(this::historyResponse).toList();
    }

    public List<SalesAttachmentResponse> getAttachments(Long id) {
        getPi(id);
        return attachmentRepository.findByModuleTypeAndModuleIdOrderByUploadedAtAsc(MODULE, id)
                .stream().map(this::attachmentResponse).toList();
    }

    public SalesAttachmentResponse addAttachment(Long id, MultipartFile file) {
        getPi(id);
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
        getPi(id);
        SalesAttachment attachment = attachmentRepository.findById(attachmentId)
                .filter(a -> MODULE.equals(a.getModuleType()) && id.equals(a.getModuleId()))
                .orElseThrow(() -> new ResourceNotFoundException("Attachment not found with id: " + attachmentId));
        attachmentRepository.delete(attachment);
    }

    private ProformaInvoiceResponse toResponse(ProformaInvoice pi) {
        List<ProformaInvoiceItemResponse> itemResponses = pi.getItems().stream().map(this::itemResponse).toList();
        BigDecimal totalQty = itemResponses.stream()
                .map(ProformaInvoiceItemResponse::qty)
                .filter(java.util.Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return new ProformaInvoiceResponse(
                pi.getId(), pi.getPiNo(),
                pi.getPiDate() == null ? null : pi.getPiDate().toLocalDate().toString(),
                pi.getReferenceNo(),
                pi.getValidTill() == null ? null : pi.getValidTill().toLocalDate().toString(),
                pi.getSource(), pi.getSourceRef(), pi.getStatus(),
                pi.getClientId(), pi.getClientName(), pi.getContactPerson(),
                pi.getGstin(), pi.getPan(), pi.getEmail(), pi.getPhone(),
                pi.getBillingAddress(), pi.isShipSameAsBill(), pi.getShippingAddress(),
                pi.getBankName(), pi.getBankAccount(), pi.getBankIfsc(), pi.getBankBranch(),
                pi.getBankType(), pi.getBankUpi(), pi.getTerms(), pi.getNotes(),
                pi.getSubTotal(), pi.getDiscount(), pi.getDiscountPct(),
                pi.getCgstTotal(), pi.getSgstTotal(), pi.getTaxTotal(),
                pi.getCharges(), pi.getGrandTotal(),
                itemResponses.size(), totalQty, pi.getConvertedToInvoice(),
                pi.getConvertedToSo(), pi.getConvertedToDc(),
                pi.getPiDate() == null
                        ? (pi.getCreatedAt() == null ? null : pi.getCreatedAt().toLocalDate().toString())
                        : pi.getPiDate().toLocalDate().toString(),
                pi.getCreatedAt() == null ? null : pi.getCreatedAt().toString(),
                pi.getUpdatedAt() == null ? null : pi.getUpdatedAt().toString(),
                pi.getArchivedAt() == null ? null : pi.getArchivedAt().toString(),
                itemResponses,
                attachmentRepository.findByModuleTypeAndModuleIdOrderByUploadedAtAsc(MODULE, pi.getId())
                        .stream().map(this::attachmentResponse).toList(),
                timelineRepository.findByModuleTypeAndModuleIdOrderByCreatedAtAsc(MODULE, pi.getId())
                        .stream().map(this::timelineResponse).toList(),
                historyRepository.findByModuleTypeAndModuleIdOrderByCreatedAtAsc(MODULE, pi.getId())
                        .stream().map(this::historyResponse).toList()
        );
    }

    private ProformaInvoiceItemResponse itemResponse(ProformaInvoiceItem item) {
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
        return new ProformaInvoiceItemResponse(item.getId(), item.getDescription(), item.getSku(), item.getHsn(),
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

    private ProformaInvoice getPi(Long id) {
        return proformaInvoiceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Proforma Invoice not found with id: " + id));
    }

    private void applyRequest(ProformaInvoice pi, ProformaInvoiceRequest request) {
        pi.setPiDate(parseDate(request.piDate()));
        pi.setReferenceNo(request.referenceNo());
        pi.setValidTill(parseDate(request.validTill()));
        pi.setSource(request.source());
        pi.setSourceRef(request.sourceRef());
        pi.setClientId(request.clientId());
        pi.setClientName(request.clientName());
        pi.setContactPerson(request.contactPerson());
        pi.setGstin(request.gstin());
        pi.setPan(request.pan());
        pi.setEmail(request.email());
        pi.setPhone(request.phone());
        pi.setBillingAddress(request.billingAddress());
        pi.setShipSameAsBill(Boolean.TRUE.equals(request.shipSameAsBill()));
        pi.setShippingAddress(request.shippingAddress());
        pi.setBankName(request.bankName());
        pi.setBankAccount(request.bankAccount());
        pi.setBankIfsc(request.bankIfsc());
        pi.setBankBranch(request.bankBranch());
        pi.setBankType(request.bankType());
        pi.setBankUpi(request.bankUpi());
        pi.setTerms(request.terms());
        pi.setNotes(request.notes());
        pi.setCharges(request.charges() == null ? BigDecimal.ZERO : request.charges());
        // ERP proforma uses a PERCENTAGE discount (Discount % input with a
        // Discount Amount display); recalcTotals converts it to the flat
        // amount persisted on the entity.
        pi.setDiscountPct(request.discountPct() == null ? BigDecimal.ZERO : request.discountPct());
        pi.getItems().clear();
        if (request.items() != null) {
            for (ProformaInvoiceItemRequest itemRequest : request.items()) {
                if (itemRequest == null) {
                    continue;
                }
                ProformaInvoiceItem item = new ProformaInvoiceItem();
                item.setDescription(itemRequest.description());
                item.setSku(itemRequest.sku());
                item.setHsn(itemRequest.hsn());
                item.setUom(itemRequest.uom());
                item.setQty(nvl(itemRequest.qty(), BigDecimal.ONE));
                item.setRate(nvl(itemRequest.rate(), BigDecimal.ZERO));
                item.setDiscountPct(nvl(itemRequest.discountPct(), BigDecimal.ZERO));
                item.setGstRate(nvl(itemRequest.gstRate(), BigDecimal.ZERO));
                pi.addItem(item);
            }
        }
    }

    private void copyItem(ProformaInvoiceItem target, ProformaInvoiceItem source) {
        target.setDescription(source.getDescription());
        target.setSku(source.getSku());
        target.setHsn(source.getHsn());
        target.setUom(source.getUom());
        target.setQty(source.getQty());
        target.setRate(source.getRate());
        target.setDiscountPct(source.getDiscountPct());
        target.setGstRate(source.getGstRate());
    }

    private void recalcTotals(ProformaInvoice pi) {
        BigDecimal subTotal = BigDecimal.ZERO;
        BigDecimal cgstTotal = BigDecimal.ZERO;
        BigDecimal sgstTotal = BigDecimal.ZERO;
        for (ProformaInvoiceItem item : pi.getItems()) {
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
        pi.setSubTotal(subTotal.setScale(2, RoundingMode.HALF_UP));
        pi.setCgstTotal(cgstTotal.setScale(2, RoundingMode.HALF_UP));
        pi.setSgstTotal(sgstTotal.setScale(2, RoundingMode.HALF_UP));
        BigDecimal taxTotal = cgstTotal.add(sgstTotal);
        pi.setTaxTotal(taxTotal.setScale(2, RoundingMode.HALF_UP));
        // ERP proforma: Discount (%) → Discount Amount = SubTotal × pct / 100;
        // Grand Total = SubTotal + Tax − Discount Amount + Charges.
        BigDecimal pct = nvl(pi.getDiscountPct(), BigDecimal.ZERO);
        BigDecimal discount = subTotal.multiply(pct)
                .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        BigDecimal charges = nvl(pi.getCharges(), BigDecimal.ZERO);
        BigDecimal grand = subTotal.add(taxTotal).subtract(discount).add(charges);
        if (grand.compareTo(BigDecimal.ZERO) < 0) {
            grand = BigDecimal.ZERO;
        }
        pi.setDiscount(discount);
        pi.setDiscountPct(pct);
        pi.setGrandTotal(grand.setScale(2, RoundingMode.HALF_UP));
    }

    private Specification<ProformaInvoice> buildSpecification(String search, String status, String client,
                                                              String dateFrom, String dateTo,
                                                              BigDecimal minAmount, BigDecimal maxAmount) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (search != null && !search.isBlank()) {
                String like = "%" + search.trim().toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("piNo")), like),
                        cb.like(cb.lower(root.get("clientName")), like),
                        cb.like(cb.lower(root.get("referenceNo")), like),
                        cb.like(cb.lower(root.get("sourceRef")), like),
                        cb.like(cb.lower(cb.toString(root.get("contactPerson"))), like)
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
            if (dateFrom != null && !dateFrom.isBlank()) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("piDate"), LocalDate.parse(dateFrom).atStartOfDay()));
            }
            if (dateTo != null && !dateTo.isBlank()) {
                predicates.add(cb.lessThanOrEqualTo(root.get("piDate"), LocalDate.parse(dateTo).atTime(23, 59, 59)));
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
            case "clientName", "piDate", "validTill", "grandTotal", "status", "createdAt", "updatedAt", "piNo"
                    -> "piNo".equals(field) ? "piNo" : field;
            case "id" -> "piNo";
            default -> "createdAt";
        };
        boolean asc = parts.length > 1 && "asc".equalsIgnoreCase(parts[1]);
        return Sort.by(asc ? Sort.Direction.ASC : Sort.Direction.DESC, mapped);
    }

    private long nextSequence() {
        long count = proformaInvoiceRepository.count();
        long maxSuffix = 0;
        String prefix = "PI-" + Year.now().getValue() + "-";
        for (ProformaInvoice pi : proformaInvoiceRepository.findAll()) {
            String no = pi.getPiNo();
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
        return String.format("PI-%d-%06d", Year.now().getValue(), sequence);
    }

    private String buildSoNumber() {
        long maxSuffix = 0;
        String prefix = "SO-" + Year.now().getValue() + "-";
        for (SalesOrder so : salesOrderRepository.findAll()) {
            String no = so.getSoNo();
            if (no != null && no.startsWith(prefix)) {
                try {
                    maxSuffix = Math.max(maxSuffix, Long.parseLong(no.substring(prefix.length())));
                } catch (NumberFormatException ignored) {
                    // skip malformed numbers
                }
            }
        }
        return String.format("SO-%d-%06d", Year.now().getValue(), Math.max(salesOrderRepository.count(), maxSuffix) + 1);
    }

    private String buildDcNumber() {
        long maxSuffix = 0;
        String prefix = "DC-" + Year.now().getValue() + "-";
        for (DeliveryChallan dc : deliveryChallanRepository.findAll()) {
            String no = dc.getDcNo();
            if (no != null && no.startsWith(prefix)) {
                try {
                    maxSuffix = Math.max(maxSuffix, Long.parseLong(no.substring(prefix.length())));
                } catch (NumberFormatException ignored) {
                    // skip malformed numbers
                }
            }
        }
        return String.format("DC-%d-%06d", Year.now().getValue(), Math.max(deliveryChallanRepository.count(), maxSuffix) + 1);
    }

    private String buildInvoiceNumber() {
        long maxSuffix = 0;
        String prefix = "INV-" + Year.now().getValue() + "-";
        for (Invoice invoice : invoiceRepository.findAll()) {
            String no = invoice.getInvoiceNo();
            if (no != null && no.startsWith(prefix)) {
                try {
                    maxSuffix = Math.max(maxSuffix, Long.parseLong(no.substring(prefix.length())));
                } catch (NumberFormatException ignored) {
                    // skip malformed numbers
                }
            }
        }
        return String.format("INV-%d-%06d", Year.now().getValue(), Math.max(invoiceRepository.count(), maxSuffix) + 1);
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
            case "sent" -> "sent";
            case "partial_paid", "partial paid" -> "partial paid";
            case "paid" -> "paid";
            case "overdue" -> "overdue";
            case "accepted" -> "accepted";
            case "expired" -> "expired";
            case "cancelled" -> "cancelled";
            case "converted" -> "converted";
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

    private void addTimeline(ProformaInvoice pi, String type, String title, String detail) {
        SalesTimeline entry = new SalesTimeline();
        entry.setModuleType(MODULE);
        entry.setModuleId(pi.getId());
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

    private void addHistory(ProformaInvoice pi, String field, String oldValue, String newValue, String changedBy) {
        SalesHistory entry = new SalesHistory();
        entry.setModuleType(MODULE);
        entry.setModuleId(pi.getId());
        entry.setField(field);
        entry.setOldValue(oldValue);
        entry.setNewValue(newValue);
        entry.setChangedBy(changedBy);
        historyRepository.save(entry);
    }
}
