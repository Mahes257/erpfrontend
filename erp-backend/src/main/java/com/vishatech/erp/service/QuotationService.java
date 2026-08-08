package com.vishatech.erp.service;

import com.vishatech.erp.dto.QuotationItemRequest;
import com.vishatech.erp.dto.QuotationItemResponse;
import com.vishatech.erp.dto.QuotationNextNumberResponse;
import com.vishatech.erp.dto.QuotationRequest;
import com.vishatech.erp.dto.QuotationResponse;
import com.vishatech.erp.dto.SalesAttachmentResponse;
import com.vishatech.erp.dto.SalesHistoryResponse;
import com.vishatech.erp.dto.SalesTimelineResponse;
import com.vishatech.erp.entity.Cpr;
import com.vishatech.erp.entity.CprItem;
import com.vishatech.erp.entity.CreditNote;
import com.vishatech.erp.entity.CreditNoteItem;
import com.vishatech.erp.entity.DeliveryChallan;
import com.vishatech.erp.entity.DeliveryChallanItem;
import com.vishatech.erp.entity.Invoice;
import com.vishatech.erp.entity.InvoiceItem;
import com.vishatech.erp.entity.PaymentReceipt;
import com.vishatech.erp.entity.ProformaInvoice;
import com.vishatech.erp.entity.ProformaInvoiceItem;
import com.vishatech.erp.entity.Quotation;
import com.vishatech.erp.entity.QuotationItem;
import com.vishatech.erp.entity.SalesAttachment;
import com.vishatech.erp.entity.SalesHistory;
import com.vishatech.erp.entity.SalesOrder;
import com.vishatech.erp.entity.SalesOrderItem;
import com.vishatech.erp.entity.SalesTimeline;
import com.vishatech.erp.exception.BadRequestException;
import com.vishatech.erp.exception.ResourceNotFoundException;
import com.vishatech.erp.repository.CreditNoteRepository;
import com.vishatech.erp.repository.DeliveryChallanRepository;
import com.vishatech.erp.repository.InvoiceRepository;
import com.vishatech.erp.repository.PaymentReceiptRepository;
import com.vishatech.erp.repository.ProformaInvoiceRepository;
import com.vishatech.erp.repository.QuotationRepository;
import com.vishatech.erp.repository.SalesAttachmentRepository;
import com.vishatech.erp.repository.SalesHistoryRepository;
import com.vishatech.erp.repository.SalesOrderRepository;
import com.vishatech.erp.repository.SalesTimelineRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
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
public class QuotationService {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final String MODULE = "quotation";

    private final QuotationRepository quotationRepository;
    private final SalesTimelineRepository timelineRepository;
    private final SalesHistoryRepository historyRepository;
    private final SalesAttachmentRepository attachmentRepository;
    private final SalesOrderRepository salesOrderRepository;
    private final ProformaInvoiceRepository proformaInvoiceRepository;
    private final InvoiceRepository invoiceRepository;
    private final CreditNoteRepository creditNoteRepository;
    private final PaymentReceiptRepository paymentReceiptRepository;
    private final DeliveryChallanRepository deliveryChallanRepository;
    private final FileStorageService fileStorageService;
    private final String baseUrl;

    @PersistenceContext
    private EntityManager entityManager;

    public QuotationService(QuotationRepository quotationRepository,
                            SalesTimelineRepository timelineRepository,
                            SalesHistoryRepository historyRepository,
                            SalesAttachmentRepository attachmentRepository,
                            SalesOrderRepository salesOrderRepository,
                            ProformaInvoiceRepository proformaInvoiceRepository,
                            InvoiceRepository invoiceRepository,
                            CreditNoteRepository creditNoteRepository,
                            PaymentReceiptRepository paymentReceiptRepository,
                            DeliveryChallanRepository deliveryChallanRepository,
                            FileStorageService fileStorageService,
                            @Value("${app.base-url:http://localhost:8080}") String baseUrl) {
        this.quotationRepository = quotationRepository;
        this.timelineRepository = timelineRepository;
        this.historyRepository = historyRepository;
        this.attachmentRepository = attachmentRepository;
        this.salesOrderRepository = salesOrderRepository;
        this.proformaInvoiceRepository = proformaInvoiceRepository;
        this.invoiceRepository = invoiceRepository;
        this.creditNoteRepository = creditNoteRepository;
        this.paymentReceiptRepository = paymentReceiptRepository;
        this.deliveryChallanRepository = deliveryChallanRepository;
        this.fileStorageService = fileStorageService;
        this.baseUrl = baseUrl;
    }

    // ============================== Read ==============================

    public Page<QuotationResponse> list(int page, int size, String search, String sort,
                                        String status, String client, String salesPerson,
                                        String dateFrom, String dateTo, String validTill,
                                        BigDecimal minAmount, BigDecimal maxAmount) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(size, 1), 200);
        Pageable pageable = PageRequest.of(safePage, safeSize, buildSort(sort));
        Specification<Quotation> spec = buildSpecification(search, status, client, salesPerson,
                dateFrom, dateTo, validTill, minAmount, maxAmount);
        return quotationRepository.findAll(spec, pageable).map(this::toResponse);
    }

    public QuotationResponse get(Long id) {
        return toResponse(getQuotation(id));
    }

    public QuotationNextNumberResponse getNextNumber() {
        long next = nextSequence();
        return new QuotationNextNumberResponse(buildNo(next), next);
    }

    public Map<String, Object> stats() {
        List<String> excluded = List.of("archived", "deleted");
        Map<String, Object> stats = new LinkedHashMap<>();
        long active = 0;
        for (String status : List.of("draft", "pending approval", "approved", "sent", "viewed", "accepted", "rejected", "negotiation", "expired", "cancelled", "converted")) {
            long count = quotationRepository.countByStatus(status);
            stats.put(status.replace(" ", ""), count);
            active += count;
        }
        stats.put("total", active);
        stats.put("active", active);
        stats.put("archived", quotationRepository.countByStatus("archived"));
        stats.put("deleted", quotationRepository.countByStatus("deleted"));
        stats.put("totalAmt", quotationRepository.sumGrandTotalExcluding(excluded));
        return stats;
    }

    // ============================== Write ==============================

    public QuotationResponse create(QuotationRequest request, boolean draft) {
        Quotation quotation = new Quotation();
        if (request.quotationNo() != null && !request.quotationNo().isBlank()) {
            if (quotationRepository.existsByQuotationNo(request.quotationNo().trim())) {
                throw new BadRequestException("Quotation number already exists: " + request.quotationNo());
            }
            quotation.setQuotationNo(request.quotationNo().trim());
        } else {
            quotation.setQuotationNo(buildNo(nextSequence()));
        }
        // Mirror the create-form validation for non-draft saves so an empty
        // payload cannot create a blank quotation. Draft saves stay lenient.
        if (!draft) {
            if (request.clientName() == null || request.clientName().isBlank()) {
                throw new BadRequestException("Client name is required");
            }
            if (request.items() == null || request.items().isEmpty()) {
                throw new BadRequestException("At least one item is required");
            }
        }
        applyRequest(quotation, request);
        if (draft) {
            quotation.setStatus("draft");
        } else if (request.status() != null && !request.status().isBlank()) {
            quotation.setStatus(normalizeStatus(request.status()));
        } else {
            quotation.setStatus("draft");
        }
        recalcTotals(quotation);
        // Persist first so the generated id is available for timeline/history rows
        // (their module_id column is NOT NULL).
        Quotation saved = quotationRepository.saveAndFlush(quotation);
        addTimeline(saved, "created", "Quotation created",
                "Quotation '" + saved.getQuotationNo() + "' was created.");
        addHistory(saved, "Quotation", null, saved.getQuotationNo(), currentUserName());
        return toResponse(saved);
    }

    public QuotationResponse update(Long id, QuotationRequest request) {
        Quotation quotation = getQuotation(id);
        applyRequest(quotation, request);
        if (request.status() != null && !request.status().isBlank()) {
            quotation.setStatus(normalizeStatus(request.status()));
        }
        recalcTotals(quotation);
        addTimeline(quotation, "updated", "Quotation updated",
                "Quotation details were updated by " + currentUserName() + ".");
        return toResponse(quotationRepository.save(quotation));
    }

    public QuotationResponse delete(Long id) {
        Quotation quotation = getQuotation(id);
        quotation.setStatus("deleted");
        quotation.setArchivedAt(LocalDateTime.now());
        addTimeline(quotation, "deleted", "Quotation deleted",
                "Quotation was moved to trash by " + currentUserName() + ".");
        addHistory(quotation, "Status", null, "Deleted", currentUserName());
        return toResponse(quotationRepository.save(quotation));
    }

    public QuotationResponse restore(Long id) {
        Quotation quotation = getQuotation(id);
        String previous = quotation.getStatus();
        String target = ("deleted".equals(previous) || "archived".equals(previous)) ? "draft" : previous;
        quotation.setStatus(target);
        quotation.setArchivedAt(null);
        addTimeline(quotation, "restored", "Quotation restored",
                "Quotation was restored by " + currentUserName() + ".");
        addHistory(quotation, "Status", titleCase(previous), titleCase(target), currentUserName());
        return toResponse(quotationRepository.save(quotation));
    }

    public QuotationResponse archive(Long id) {
        Quotation quotation = getQuotation(id);
        quotation.setStatus("archived");
        quotation.setArchivedAt(LocalDateTime.now());
        addTimeline(quotation, "archived", "Quotation archived",
                "Quotation was archived by " + currentUserName() + ".");
        addHistory(quotation, "Status", null, "Archived", currentUserName());
        return toResponse(quotationRepository.save(quotation));
    }

    public QuotationResponse changeStatus(Long id, String status, String remarks) {
        Quotation quotation = getQuotation(id);
        String normalized = normalizeStatus(status);
        if ("deleted".equals(quotation.getStatus())) {
            throw new BadRequestException("Cannot change status of a deleted quotation");
        }
        quotation.setStatus(normalized);
        if (remarks != null && !remarks.isBlank()) {
            addTimeline(quotation, "status", "Status changed",
                    "Status changed to '" + titleCase(normalized) + "' by " + currentUserName()
                            + ". Remarks: " + remarks.trim());
            addHistory(quotation, "Status", null, titleCase(normalized), currentUserName());
            addHistory(quotation, "Remarks", null, remarks.trim(), currentUserName());
        } else {
            addTimeline(quotation, "status", "Status changed",
                    "Status changed to '" + titleCase(normalized) + "' by " + currentUserName() + ".");
            addHistory(quotation, "Status", null, titleCase(normalized), currentUserName());
        }
        return toResponse(quotationRepository.save(quotation));
    }

    public QuotationResponse duplicate(Long id) {
        Quotation source = getQuotation(id);
        Quotation copy = new Quotation();
        copy.setQuotationNo(buildNo(nextSequence()));
        copyReferenceFields(copy, source);
        copy.setStatus("draft");
        copy.setQuotationDate(LocalDateTime.now());
        for (QuotationItem sourceItem : source.getItems()) {
            QuotationItem item = new QuotationItem();
            copyItem(item, sourceItem);
            copy.addItem(item);
        }
        recalcTotals(copy);
        Quotation saved = quotationRepository.saveAndFlush(copy);
        addTimeline(saved, "created", "Quotation created",
                "Duplicated from Quotation '" + source.getQuotationNo() + "'.");
        addHistory(saved, "Quotation", null, saved.getQuotationNo(), currentUserName());
        return toResponse(saved);
    }

    public int bulkArchive(List<Long> ids) {
        int count = 0;
        for (Long id : ids) {
            Quotation quotation = getQuotation(id);
            if (!"archived".equals(quotation.getStatus()) && !"deleted".equals(quotation.getStatus())) {
                quotation.setStatus("archived");
                quotation.setArchivedAt(LocalDateTime.now());
                addTimeline(quotation, "archived", "Quotation archived",
                        "Quotation was archived by " + currentUserName() + ".");
                quotationRepository.save(quotation);
                count++;
            }
        }
        return count;
    }

    public int bulkRestore(List<Long> ids) {
        int count = 0;
        for (Long id : ids) {
            Quotation quotation = getQuotation(id);
            if ("archived".equals(quotation.getStatus()) || "deleted".equals(quotation.getStatus())) {
                quotation.setStatus("draft");
                quotation.setArchivedAt(null);
                addTimeline(quotation, "restored", "Quotation restored",
                        "Quotation was restored by " + currentUserName() + ".");
                quotationRepository.save(quotation);
                count++;
            }
        }
        return count;
    }

    public int bulkDelete(List<Long> ids) {
        // Soft delete for trash parity with the single-delete endpoint: rows are
        // marked status="deleted" (and restorable) instead of being removed from
        // MySQL. Previously this hard-deleted rows while the UI said "trash".
        int count = 0;
        for (Long id : ids) {
            Quotation quotation = getQuotation(id);
            if (!"deleted".equals(quotation.getStatus())) {
                quotation.setStatus("deleted");
                quotation.setArchivedAt(LocalDateTime.now());
                addTimeline(quotation, "deleted", "Quotation deleted",
                        "Quotation was moved to trash by " + currentUserName() + ".");
                addHistory(quotation, "Status", null, "Deleted", currentUserName());
                quotationRepository.save(quotation);
                count++;
            }
        }
        return count;
    }

    /**
     * Creates a real Quotation row from a converted CPR. Used by the CPR module's
     * "Convert to Quotation" action so the quotation is persisted in MySQL and the
     * CPR is linked to the created quotation id/number.
     */
    public QuotationResponse createFromCpr(Cpr cpr) {
        Quotation quotation = new Quotation();
        quotation.setQuotationNo(buildNo(nextSequence()));
        quotation.setReference("Generated from CPR " + (cpr.getPrNo() == null ? "" : cpr.getPrNo()));
        quotation.setQuotationDate(LocalDateTime.now());
        quotation.setValidUntil(LocalDateTime.now().plusDays(30));
        quotation.setLeadNo(cpr.getLeadNo());
        quotation.setSourceCpr(cpr.getPrNo());
        quotation.setClientName(cpr.getClientName() != null ? cpr.getClientName() : cpr.getSourceLead());
        quotation.setContactPerson(cpr.getContactPerson());
        quotation.setEmail(cpr.getEmail());
        quotation.setPhone(cpr.getPhone());
        quotation.setAddress(cpr.getBillingAddress());
        quotation.setGstin(cpr.getGst());
        quotation.setPan(cpr.getPan());
        quotation.setBillingAddress(cpr.getBillingAddress());
        quotation.setShipSameAsBill(true);
        quotation.setShippingAddress(cpr.getShippingAddress());
        quotation.setCurrency("INR");
        quotation.setStatus("draft");
        quotation.setRemarks(cpr.getRemarks());
        quotation.setDiscount(BigDecimal.ZERO);
        quotation.setCharges(BigDecimal.ZERO);
        quotation.setFreight(BigDecimal.ZERO);
        quotation.setInsurance(BigDecimal.ZERO);
        if (cpr.getItems() != null) {
            for (CprItem cprItem : cpr.getItems()) {
                QuotationItem item = new QuotationItem();
                item.setDescription(cprItem.getDescription());
                item.setSku(cprItem.getDrawingNo());
                item.setHsn(null);
                item.setUom(cprItem.getUnit());
                item.setQty(nvl(cprItem.getQty(), BigDecimal.ONE));
                item.setRate(nvl(cprItem.getEstimatedCost(), BigDecimal.ZERO));
                item.setDiscountPct(BigDecimal.ZERO);
                // App-wide default GST rate (matches the Cost Workout default).
                item.setGstRate(BigDecimal.valueOf(18));
                quotation.addItem(item);
            }
        }
        recalcTotals(quotation);
        // Persist first so the generated id is available for timeline/history rows
        // (their module_id column is NOT NULL).
        Quotation saved = quotationRepository.saveAndFlush(quotation);
        addTimeline(saved, "created", "Quotation created from CPR",
                "Quotation '" + saved.getQuotationNo() + "' was created from CPR '"
                        + (cpr.getPrNo() == null ? "" : cpr.getPrNo()) + "'.");
        addHistory(saved, "Quotation", null, saved.getQuotationNo(), currentUserName());
        return toResponse(saved);
    }

    /**
     * POST /quotations/{id}/send — records the send event (email to client).
     * Mirrors the original ERP action; the actual email delivery is handled
     * by the mailto flow on the frontend.
     */
    public QuotationResponse send(Long id) {
        Quotation quotation = getQuotation(id);
        if ("draft".equals(quotation.getStatus())) {
            quotation.setStatus("sent");
            addTimeline(quotation, "sent", "Quotation sent",
                    "Quotation sent to " + (quotation.getEmail() == null ? "client" : quotation.getEmail()) + ".");
            addHistory(quotation, "Status", "Draft", "Sent", currentUserName());
        } else {
            addTimeline(quotation, "sent", "Quotation sent",
                    "Quotation was emailed to the client by " + currentUserName() + ".");
        }
        return toResponse(quotationRepository.save(quotation));
    }

    /**
     * Quotation → Sales Order conversion. Creates a draft Sales Order from the
     * quotation and marks the quotation as converted.
     */
    public QuotationResponse convertToSalesOrder(Long id) {
        Quotation quotation = getQuotation(id);
        if ("converted".equals(quotation.getStatus())) {
            throw new BadRequestException("Quotation is already converted to a Sales Order");
        }
        SalesOrder so = new SalesOrder();
        so.setSoNo(buildSoNumber());
        so.setQtnRef(quotation.getQuotationNo());
        so.setLeadNo(quotation.getLeadNo());
        so.setOrderDate(LocalDateTime.now());
        so.setStatus("draft");
        so.setCurrency(quotation.getCurrency() == null ? "INR" : quotation.getCurrency());
        so.setClientId(quotation.getClientId());
        so.setClientName(quotation.getClientName());
        so.setContactPerson(quotation.getContactPerson());
        so.setEmail(quotation.getEmail());
        so.setPhone(quotation.getPhone());
        so.setCity(quotation.getCity());
        so.setState(quotation.getState());
        so.setBillingAddress(quotation.getBillingAddress());
        so.setShippingAddress(quotation.getShippingAddress());
        so.setGstin(quotation.getGstin());
        so.setPan(quotation.getPan());
        so.setPaymentTerms(quotation.getPaymentTerms());
        so.setSalesExecutive(quotation.getSalesPerson());
        so.setTerms(quotation.getTerms());
        so.setRemarks(quotation.getRemarks());
        for (QuotationItem sourceItem : quotation.getItems()) {
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
        so.setSubTotal(quotation.getSubTotal());
        so.setDiscount(quotation.getDiscount());
        so.setTaxTotal(quotation.getTaxTotal());
        so.setCgstTotal(quotation.getCgstTotal());
        so.setSgstTotal(quotation.getSgstTotal());
        so.setCharges(quotation.getCharges());
        so.setGrandTotal(quotation.getGrandTotal());
        SalesOrder savedSo = salesOrderRepository.save(so);

        addTargetTimeline("sales-order", savedSo.getId(), "created", "Sales Order created",
                "Sales Order '" + savedSo.getSoNo() + "' created from Quotation '" + quotation.getQuotationNo() + "'.");
        addTargetHistory("sales-order", savedSo.getId(), "Sales Order", savedSo.getSoNo(), currentUserName());

        quotation.setStatus("converted");
        quotation.setConvertedToSo(so.getSoNo());
        addTimeline(quotation, "converted", "Converted to Sales Order",
                "Quotation converted to Sales Order " + so.getSoNo() + ".");
        addHistory(quotation, "Status", null, "Converted", currentUserName());
        return toResponse(quotationRepository.save(quotation));
    }

    /** Quotation → Proforma Invoice conversion. */
    public QuotationResponse convertToProforma(Long id) {
        Quotation quotation = getQuotation(id);
        if (quotation.getConvertedToPi() != null || "converted".equals(quotation.getStatus())) {
            throw new BadRequestException("Quotation already converted to another document");
        }
        ProformaInvoice pi = new ProformaInvoice();
        pi.setPiNo(buildPiNumber());
        pi.setPiDate(LocalDateTime.now());
        pi.setStatus("draft");
        pi.setSource("quotation");
        pi.setSourceRef(quotation.getQuotationNo());
        pi.setClientId(quotation.getClientId());
        pi.setClientName(quotation.getClientName());
        pi.setContactPerson(quotation.getContactPerson());
        pi.setEmail(quotation.getEmail());
        pi.setPhone(quotation.getPhone());
        pi.setGstin(quotation.getGstin());
        pi.setPan(quotation.getPan());
        pi.setBillingAddress(quotation.getBillingAddress());
        pi.setShippingAddress(quotation.getShippingAddress());
        pi.setValidTill(quotation.getValidUntil());
        pi.setTerms(quotation.getTerms());
        pi.setNotes(quotation.getRemarks());
        for (QuotationItem sourceItem : quotation.getItems()) {
            ProformaInvoiceItem item = new ProformaInvoiceItem();
            item.setDescription(sourceItem.getDescription());
            item.setSku(sourceItem.getSku());
            item.setHsn(sourceItem.getHsn());
            item.setUom(sourceItem.getUom());
            item.setQty(sourceItem.getQty());
            item.setRate(sourceItem.getRate());
            item.setDiscountPct(sourceItem.getDiscountPct());
            item.setGstRate(sourceItem.getGstRate());
            pi.addItem(item);
        }
        pi.setSubTotal(quotation.getSubTotal());
        pi.setDiscount(quotation.getDiscount());
        pi.setDiscountPct(quotation.getDiscountPct());
        pi.setTaxTotal(quotation.getTaxTotal());
        pi.setCgstTotal(quotation.getCgstTotal());
        pi.setSgstTotal(quotation.getSgstTotal());
        pi.setCharges(quotation.getCharges());
        pi.setGrandTotal(quotation.getGrandTotal());
        ProformaInvoice savedPi = proformaInvoiceRepository.save(pi);
        addTargetTimeline("proforma-invoice", savedPi.getId(), "created", "Proforma Invoice created",
                "Proforma Invoice '" + savedPi.getPiNo() + "' created from Quotation '" + quotation.getQuotationNo() + "'.");
        addTargetHistory("proforma-invoice", savedPi.getId(), "Proforma Invoice", savedPi.getPiNo(), currentUserName());

        quotation.setConvertedToPi(savedPi.getPiNo());
        quotation.setStatus("converted");
        addTimeline(quotation, "converted", "Converted to Proforma Invoice",
                "Quotation converted to Proforma Invoice " + savedPi.getPiNo() + ".");
        addHistory(quotation, "Status", null, "Converted", currentUserName());
        return toResponse(quotationRepository.save(quotation));
    }

    /** Quotation → Invoice conversion. */
    public QuotationResponse convertToInvoice(Long id) {
        Quotation quotation = getQuotation(id);
        if (quotation.getConvertedToInvoice() != null || "converted".equals(quotation.getStatus())) {
            throw new BadRequestException("Quotation already converted to another document");
        }
        Invoice invoice = new Invoice();
        invoice.setInvoiceNo(buildInvoiceNumber());
        invoice.setInvoiceDate(LocalDateTime.now());
        invoice.setStatus("draft");
        invoice.setSource("quotation");
        invoice.setSourceRef(quotation.getQuotationNo());
        invoice.setCompanyName(quotation.getFromName() != null ? quotation.getFromName() : quotation.getFromCompany());
        invoice.setCompanyGstin(quotation.getFromGstin());
        invoice.setCompanyPan(quotation.getFromPan());
        invoice.setCompanyAddress(quotation.getFromAddress());
        invoice.setClientId(quotation.getClientId());
        invoice.setClientName(quotation.getClientName());
        invoice.setContactPerson(quotation.getContactPerson());
        invoice.setEmail(quotation.getEmail());
        invoice.setPhone(quotation.getPhone());
        invoice.setGstin(quotation.getGstin());
        invoice.setPan(quotation.getPan());
        invoice.setBillingAddress(quotation.getBillingAddress());
        invoice.setShippingAddress(quotation.getShippingAddress());
        invoice.setTerms(quotation.getTerms());
        invoice.setNotes(quotation.getRemarks());
        for (QuotationItem sourceItem : quotation.getItems()) {
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
        invoice.setSubTotal(quotation.getSubTotal());
        invoice.setDiscount(quotation.getDiscount());
        invoice.setTaxTotal(quotation.getTaxTotal());
        invoice.setCgstTotal(quotation.getCgstTotal());
        invoice.setSgstTotal(quotation.getSgstTotal());
        invoice.setCharges(quotation.getCharges());
        invoice.setGrandTotal(quotation.getGrandTotal());
        Invoice savedInv = invoiceRepository.save(invoice);
        addTargetTimeline("invoice", savedInv.getId(), "created", "Invoice created",
                "Invoice '" + savedInv.getInvoiceNo() + "' created from Quotation '" + quotation.getQuotationNo() + "'.");
        addTargetHistory("invoice", savedInv.getId(), "Invoice", savedInv.getInvoiceNo(), currentUserName());

        quotation.setConvertedToInvoice(savedInv.getInvoiceNo());
        quotation.setStatus("converted");
        addTimeline(quotation, "converted", "Converted to Invoice",
                "Quotation converted to Invoice " + savedInv.getInvoiceNo() + ".");
        addHistory(quotation, "Status", null, "Converted", currentUserName());
        return toResponse(quotationRepository.save(quotation));
    }

    /** Quotation → Credit Note conversion. */
    public QuotationResponse convertToCreditNote(Long id) {
        Quotation quotation = getQuotation(id);
        if (quotation.getConvertedToCn() != null || "converted".equals(quotation.getStatus())) {
            throw new BadRequestException("Quotation already converted to another document");
        }
        CreditNote cn = new CreditNote();
        cn.setCnNo(buildCnNumber());
        cn.setCnDate(LocalDateTime.now());
        cn.setStatus("draft");
        cn.setSource("quotation");
        cn.setSourceRef(quotation.getQuotationNo());
        cn.setCompanyName(quotation.getFromName() != null ? quotation.getFromName() : quotation.getFromCompany());
        cn.setCompanyGstin(quotation.getFromGstin());
        cn.setCompanyPan(quotation.getFromPan());
        cn.setCompanyAddress(quotation.getFromAddress());
        cn.setReason("Quotation converted to Credit Note");
        cn.setReasonDetail("Credit Note generated from Quotation " + quotation.getQuotationNo());
        cn.setInventoryImpact("none");
        cn.setClientId(quotation.getClientId());
        cn.setClientName(quotation.getClientName());
        cn.setContactPerson(quotation.getContactPerson());
        cn.setEmail(quotation.getEmail());
        cn.setPhone(quotation.getPhone());
        cn.setGstin(quotation.getGstin());
        for (QuotationItem sourceItem : quotation.getItems()) {
            CreditNoteItem item = new CreditNoteItem();
            item.setDescription(sourceItem.getDescription());
            item.setSku(sourceItem.getSku());
            item.setHsn(sourceItem.getHsn());
            item.setUom(sourceItem.getUom());
            item.setQty(sourceItem.getQty());
            item.setRate(sourceItem.getRate());
            item.setDiscountPct(sourceItem.getDiscountPct());
            item.setGstRate(sourceItem.getGstRate());
            cn.addItem(item);
        }
        cn.setSubTotal(quotation.getSubTotal());
        cn.setDiscount(quotation.getDiscount());
        cn.setTaxTotal(quotation.getTaxTotal());
        cn.setCgstTotal(quotation.getCgstTotal());
        cn.setSgstTotal(quotation.getSgstTotal());
        cn.setCharges(quotation.getCharges());
        cn.setGrandTotal(quotation.getGrandTotal());
        cn.setRefundAmount(quotation.getGrandTotal());
        CreditNote savedCn = creditNoteRepository.save(cn);
        addTargetTimeline("credit-note", savedCn.getId(), "created", "Credit Note created",
                "Credit Note '" + savedCn.getCnNo() + "' created from Quotation '" + quotation.getQuotationNo() + "'.");
        addTargetHistory("credit-note", savedCn.getId(), "Credit Note", savedCn.getCnNo(), currentUserName());

        quotation.setConvertedToCn(savedCn.getCnNo());
        quotation.setStatus("converted");
        addTimeline(quotation, "converted", "Converted to Credit Note",
                "Quotation converted to Credit Note " + savedCn.getCnNo() + ".");
        addHistory(quotation, "Status", null, "Converted", currentUserName());
        return toResponse(quotationRepository.save(quotation));
    }

    /** Quotation → Payment Receipt conversion. */
    public QuotationResponse convertToPaymentReceipt(Long id) {
        Quotation quotation = getQuotation(id);
        if (quotation.getConvertedToPr() != null || "converted".equals(quotation.getStatus())) {
            throw new BadRequestException("Quotation already converted to another document");
        }
        PaymentReceipt receipt = new PaymentReceipt();
        receipt.setReceiptNo(buildPrNumber());
        receipt.setPaymentDate(LocalDateTime.now());
        receipt.setStatus("draft");
        receipt.setSource("quotation");
        receipt.setInvoiceRef(quotation.getQuotationNo());
        receipt.setCompanyName(quotation.getFromName() != null ? quotation.getFromName() : quotation.getFromCompany());
        receipt.setCompanyGstin(quotation.getFromGstin());
        receipt.setCompanyPan(quotation.getFromPan());
        receipt.setCompanyAddress(quotation.getFromAddress());
        receipt.setClientId(quotation.getClientId());
        receipt.setClientName(quotation.getClientName());
        receipt.setContactPerson(quotation.getContactPerson());
        receipt.setEmail(quotation.getEmail());
        receipt.setPhone(quotation.getPhone());
        receipt.setGstin(quotation.getGstin());
        receipt.setAmount(quotation.getGrandTotal());
        receipt.setRemarks("Payment receipt generated from Quotation " + quotation.getQuotationNo());
        PaymentReceipt savedPr = paymentReceiptRepository.save(receipt);
        addTargetTimeline("payment-receipt", savedPr.getId(), "created", "Payment Receipt created",
                "Payment Receipt '" + savedPr.getReceiptNo() + "' created from Quotation '" + quotation.getQuotationNo() + "'.");
        addTargetHistory("payment-receipt", savedPr.getId(), "Payment Receipt", savedPr.getReceiptNo(), currentUserName());

        quotation.setConvertedToPr(savedPr.getReceiptNo());
        quotation.setStatus("converted");
        addTimeline(quotation, "converted", "Converted to Payment Receipt",
                "Quotation converted to Payment Receipt " + savedPr.getReceiptNo() + ".");
        addHistory(quotation, "Status", null, "Converted", currentUserName());
        return toResponse(quotationRepository.save(quotation));
    }

    /** Quotation → Delivery Challan conversion. */
    public QuotationResponse convertToDeliveryChallan(Long id) {
        Quotation quotation = getQuotation(id);
        if ("converted".equals(quotation.getStatus())) {
            throw new BadRequestException("Quotation already converted to another document");
        }
        DeliveryChallan dc = new DeliveryChallan();
        dc.setDcNo(buildDcNumber());
        dc.setDcDate(LocalDateTime.now());
        dc.setStatus("draft");
        dc.setClientId(quotation.getClientId());
        dc.setClientName(quotation.getClientName());
        dc.setContactPerson(quotation.getContactPerson());
        dc.setEmail(quotation.getEmail());
        dc.setPhone(quotation.getPhone());
        dc.setBillingAddress(quotation.getBillingAddress());
        dc.setShippingAddress(quotation.getShippingAddress());
        dc.setCity(quotation.getCity());
        dc.setState(quotation.getState());
        dc.setTerms(quotation.getTerms());
        dc.setNotes(quotation.getRemarks());
        for (QuotationItem sourceItem : quotation.getItems()) {
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
        dc.setSubTotal(quotation.getSubTotal());
        dc.setDiscount(quotation.getDiscount());
        dc.setTaxTotal(quotation.getTaxTotal());
        dc.setCgstTotal(quotation.getCgstTotal());
        dc.setSgstTotal(quotation.getSgstTotal());
        dc.setCharges(quotation.getCharges());
        dc.setGrandTotal(quotation.getGrandTotal());
        DeliveryChallan savedDc = deliveryChallanRepository.save(dc);
        addTargetTimeline("delivery-challan", savedDc.getId(), "created", "Delivery Challan created",
                "Delivery Challan '" + savedDc.getDcNo() + "' created from Quotation '" + quotation.getQuotationNo() + "'.");
        addTargetHistory("delivery-challan", savedDc.getId(), "Delivery Challan", savedDc.getDcNo(), currentUserName());

        quotation.setStatus("converted");
        addTimeline(quotation, "converted", "Converted to Delivery Challan",
                "Quotation converted to Delivery Challan " + savedDc.getDcNo() + ".");
        addHistory(quotation, "Status", null, "Converted", currentUserName());
        return toResponse(quotationRepository.save(quotation));
    }

    // ============================== Export ==============================

    public List<QuotationResponse> export(String search, String status, String client, String salesPerson,
                                          String dateFrom, String dateTo, String validTill,
                                          BigDecimal minAmount, BigDecimal maxAmount) {
        Specification<Quotation> spec = buildSpecification(search, status, client, salesPerson,
                dateFrom, dateTo, validTill, minAmount, maxAmount);
        return quotationRepository.findAll(spec).stream().map(this::toResponse).toList();
    }

    public String buildCsv(List<QuotationResponse> quotations) {
        StringBuilder sb = new StringBuilder();
        sb.append("Quotation No,Date,Client,Sales Person,Items,Amount,Valid Until,Status,Created\n");
        for (QuotationResponse q : quotations) {
            sb.append(escapeCsv(q.quotationNo())).append(',')
              .append(escapeCsv(q.date())).append(',')
              .append(escapeCsv(q.clientName())).append(',')
              .append(escapeCsv(q.salesPerson())).append(',')
              .append(q.itemsCount() == null ? "" : q.itemsCount()).append(',')
              .append(q.grandTotal() == null ? "" : q.grandTotal().toPlainString()).append(',')
              .append(escapeCsv(q.validUntil())).append(',')
              .append(escapeCsv(q.status())).append(',')
              .append(escapeCsv(q.createdAt())).append('\n');
        }
        return sb.toString();
    }

    // ============================== Sub-resources ==============================

    public List<SalesTimelineResponse> getTimeline(Long id) {
        getQuotation(id);
        return timelineRepository.findByModuleTypeAndModuleIdOrderByCreatedAtAsc(MODULE, id)
                .stream().map(this::timelineResponse).toList();
    }

    public List<SalesHistoryResponse> getHistory(Long id) {
        getQuotation(id);
        return historyRepository.findByModuleTypeAndModuleIdOrderByCreatedAtAsc(MODULE, id)
                .stream().map(this::historyResponse).toList();
    }

    public List<SalesAttachmentResponse> getAttachments(Long id) {
        getQuotation(id);
        return attachmentRepository.findByModuleTypeAndModuleIdOrderByUploadedAtAsc(MODULE, id)
                .stream().map(this::attachmentResponse).toList();
    }

    public SalesAttachmentResponse addAttachment(Long id, MultipartFile file) {
        getQuotation(id);
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
        getQuotation(id);
        SalesAttachment attachment = attachmentRepository.findById(attachmentId)
                .filter(a -> MODULE.equals(a.getModuleType()) && id.equals(a.getModuleId()))
                .orElseThrow(() -> new ResourceNotFoundException("Attachment not found with id: " + attachmentId));
        attachmentRepository.delete(attachment);
    }

    // ============================== Mapping ==============================

    private QuotationResponse toResponse(Quotation quotation) {
        List<QuotationItemResponse> itemResponses = quotation.getItems().stream().map(this::itemResponse).toList();
        BigDecimal totalQty = itemResponses.stream()
                .map(QuotationItemResponse::qty)
                .filter(java.util.Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return new QuotationResponse(
                quotation.getId(),
                quotation.getQuotationNo(),
                quotation.getReference(),
                quotation.getQuotationDate() == null ? null : quotation.getQuotationDate().toLocalDate().toString(),
                quotation.getValidUntil() == null ? null : quotation.getValidUntil().toLocalDate().toString(),
                quotation.getLeadNo(),
                quotation.getSourceCw(),
                quotation.getSourceCpr(),
                quotation.getFromCompany(),
                quotation.getFromName(),
                quotation.getFromAddress(),
                quotation.getFromGstin(),
                quotation.getFromPan(),
                quotation.getFromEmail(),
                quotation.getFromPhone(),
                quotation.getClientId(),
                quotation.getClientName(),
                quotation.getContactPerson(),
                quotation.getEmail(),
                quotation.getPhone(),
                quotation.getAddress(),
                quotation.getCity(),
                quotation.getState(),
                quotation.getPin(),
                quotation.getCountry(),
                quotation.getGstin(),
                quotation.getPan(),
                quotation.getBillingAddress(),
                quotation.getBillingCity(),
                quotation.getBillingState(),
                quotation.getBillingPin(),
                quotation.isShipSameAsBill(),
                quotation.getShippingAddress(),
                quotation.getShippingCity(),
                quotation.getShippingState(),
                quotation.getShippingPin(),
                quotation.getTaxType(),
                quotation.getCurrency(),
                quotation.getExchangeRate(),
                quotation.getBaseCurrency(),
                quotation.getNumberFormat(),
                quotation.getStatus(),
                quotation.getSalesPerson(),
                quotation.getPaymentTerms(),
                quotation.getRemarks(),
                quotation.getTerms(),
                quotation.getSubTotal(),
                quotation.getDiscount(),
                quotation.getDiscountPct(),
                quotation.getCgstTotal(),
                quotation.getSgstTotal(),
                quotation.getTaxTotal(),
                quotation.getCharges(),
                quotation.getDeliveryTerms(),
                quotation.getFreight(),
                quotation.getInsurance(),
                quotation.getSignatureType(),
                quotation.getSignatureLabel(),
                quotation.getHsnView(),
                quotation.getDisplayUnit(),
                quotation.getAdditionalInfo(),
                quotation.getContactEmail(),
                quotation.getContactPhone(),
                quotation.getGrandTotal(),
                itemResponses.size(),
                totalQty,
                quotation.getConvertedToSo(),
                quotation.getConvertedToPi(),
                quotation.getConvertedToInvoice(),
                quotation.getConvertedToCn(),
                quotation.getConvertedToPr(),
                quotation.getQuotationDate() == null
                        ? (quotation.getCreatedAt() == null ? null : quotation.getCreatedAt().toLocalDate().toString())
                        : quotation.getQuotationDate().toLocalDate().toString(),
                quotation.getCreatedAt() == null ? null : quotation.getCreatedAt().toString(),
                quotation.getUpdatedAt() == null ? null : quotation.getUpdatedAt().toString(),
                quotation.getArchivedAt() == null ? null : quotation.getArchivedAt().toString(),
                itemResponses,
                attachmentRepository.findByModuleTypeAndModuleIdOrderByUploadedAtAsc(MODULE, quotation.getId())
                        .stream().map(this::attachmentResponse).toList(),
                timelineRepository.findByModuleTypeAndModuleIdOrderByCreatedAtAsc(MODULE, quotation.getId())
                        .stream().map(this::timelineResponse).toList(),
                historyRepository.findByModuleTypeAndModuleIdOrderByCreatedAtAsc(MODULE, quotation.getId())
                        .stream().map(this::historyResponse).toList()
        );
    }

    private QuotationItemResponse itemResponse(QuotationItem item) {
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
        return new QuotationItemResponse(item.getId(), item.getDescription(), item.getSku(), item.getHsn(),
                item.getUom(), qty, rate, discPct, gst,
                gross.setScale(2, RoundingMode.HALF_UP),
                discAmt.setScale(2, RoundingMode.HALF_UP),
                net.setScale(2, RoundingMode.HALF_UP),
                cgst.setScale(2, RoundingMode.HALF_UP),
                sgst.setScale(2, RoundingMode.HALF_UP),
                total.setScale(2, RoundingMode.HALF_UP));
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

    // ============================== Helpers ==============================

    private Quotation getQuotation(Long id) {
        return quotationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Quotation not found with id: " + id));
    }

    private void applyRequest(Quotation quotation, QuotationRequest request) {
        quotation.setReference(request.reference());
        quotation.setQuotationDate(parseDate(request.quotationDate()));
        quotation.setValidUntil(parseDate(request.validUntil()));
        quotation.setLeadNo(request.leadNo());
        quotation.setSourceCw(request.sourceCw());
        quotation.setSourceCpr(request.sourceCpr());
        quotation.setFromCompany(request.fromCompany());
        quotation.setFromName(request.fromName());
        quotation.setFromAddress(request.fromAddress());
        quotation.setFromGstin(request.fromGstin());
        quotation.setFromPan(request.fromPan());
        quotation.setFromEmail(request.fromEmail());
        quotation.setFromPhone(request.fromPhone());
        quotation.setClientId(request.clientId());
        quotation.setClientName(request.clientName());
        quotation.setContactPerson(request.contactPerson());
        quotation.setEmail(request.email());
        quotation.setPhone(request.phone());
        quotation.setAddress(request.address());
        quotation.setCity(request.city());
        quotation.setState(request.state());
        quotation.setPin(request.pin());
        quotation.setCountry(request.country());
        quotation.setGstin(request.gstin());
        quotation.setPan(request.pan());
        quotation.setBillingAddress(request.billingAddress());
        quotation.setBillingCity(request.billingCity());
        quotation.setBillingState(request.billingState());
        quotation.setBillingPin(request.billingPin());
        quotation.setShipSameAsBill(Boolean.TRUE.equals(request.shipSameAsBill()));
        quotation.setShippingAddress(request.shippingAddress());
        quotation.setShippingCity(request.shippingCity());
        quotation.setShippingState(request.shippingState());
        quotation.setShippingPin(request.shippingPin());
        quotation.setTaxType(request.taxType());
        quotation.setCurrency(request.currency());
        quotation.setExchangeRate(request.exchangeRate());
        quotation.setBaseCurrency(request.baseCurrency());
        quotation.setNumberFormat(request.numberFormat());
        quotation.setSalesPerson(request.salesPerson());
        quotation.setPaymentTerms(request.paymentTerms());
        quotation.setRemarks(request.remarks());
        quotation.setTerms(request.terms());
        quotation.setDiscount(request.discount() == null ? BigDecimal.ZERO : request.discount());
        quotation.setCharges(request.charges() == null ? BigDecimal.ZERO : request.charges());
        quotation.setDeliveryTerms(request.deliveryTerms());
        quotation.setFreight(request.freight() == null ? BigDecimal.ZERO : request.freight());
        quotation.setInsurance(request.insurance() == null ? BigDecimal.ZERO : request.insurance());
        quotation.setSignatureType(request.signatureType());
        quotation.setSignatureLabel(request.signatureLabel());
        quotation.setHsnView(request.hsnView());
        quotation.setDisplayUnit(request.displayUnit());
        quotation.setAdditionalInfo(request.additionalInfo());
        quotation.setContactEmail(request.contactEmail());
        quotation.setContactPhone(request.contactPhone());
        if (request.items() != null) {
            // Only replace items when the payload actually carries them, so a
            // partial update can never silently wipe persisted line items.
            quotation.getItems().clear();
            for (QuotationItemRequest itemRequest : request.items()) {
                if (itemRequest == null) {
                    continue;
                }
                QuotationItem item = new QuotationItem();
                item.setDescription(itemRequest.description());
                item.setSku(itemRequest.sku());
                item.setHsn(itemRequest.hsn());
                item.setUom(itemRequest.uom());
                item.setQty(nvl(itemRequest.qty(), BigDecimal.ONE));
                item.setRate(nvl(itemRequest.rate(), BigDecimal.ZERO));
                item.setDiscountPct(nvl(itemRequest.discountPct(), BigDecimal.ZERO));
                item.setGstRate(nvl(itemRequest.gstRate(), BigDecimal.ZERO));
                quotation.addItem(item);
            }
        }
    }

    private void copyReferenceFields(Quotation copy, Quotation source) {
        copy.setReference(source.getReference());
        copy.setValidUntil(source.getValidUntil());
        copy.setLeadNo(source.getLeadNo());
        copy.setSourceCw(source.getSourceCw());
        copy.setSourceCpr(source.getSourceCpr());
        copy.setFromCompany(source.getFromCompany());
        copy.setFromName(source.getFromName());
        copy.setFromAddress(source.getFromAddress());
        copy.setFromGstin(source.getFromGstin());
        copy.setFromPan(source.getFromPan());
        copy.setFromEmail(source.getFromEmail());
        copy.setFromPhone(source.getFromPhone());
        copy.setClientId(source.getClientId());
        copy.setClientName(source.getClientName());
        copy.setContactPerson(source.getContactPerson());
        copy.setEmail(source.getEmail());
        copy.setPhone(source.getPhone());
        copy.setAddress(source.getAddress());
        copy.setCity(source.getCity());
        copy.setState(source.getState());
        copy.setPin(source.getPin());
        copy.setCountry(source.getCountry());
        copy.setGstin(source.getGstin());
        copy.setPan(source.getPan());
        copy.setBillingAddress(source.getBillingAddress());
        copy.setBillingCity(source.getBillingCity());
        copy.setBillingState(source.getBillingState());
        copy.setBillingPin(source.getBillingPin());
        copy.setShipSameAsBill(source.isShipSameAsBill());
        copy.setShippingAddress(source.getShippingAddress());
        copy.setShippingCity(source.getShippingCity());
        copy.setShippingState(source.getShippingState());
        copy.setShippingPin(source.getShippingPin());
        copy.setTaxType(source.getTaxType());
        copy.setCurrency(source.getCurrency());
        copy.setExchangeRate(source.getExchangeRate());
        copy.setBaseCurrency(source.getBaseCurrency());
        copy.setNumberFormat(source.getNumberFormat());
        copy.setSalesPerson(source.getSalesPerson());
        copy.setPaymentTerms(source.getPaymentTerms());
        copy.setRemarks(source.getRemarks());
        copy.setTerms(source.getTerms());
        copy.setDiscount(source.getDiscount());
        copy.setCharges(source.getCharges());
    }

    private void copyItem(QuotationItem target, QuotationItem source) {
        target.setDescription(source.getDescription());
        target.setSku(source.getSku());
        target.setHsn(source.getHsn());
        target.setUom(source.getUom());
        target.setQty(source.getQty());
        target.setRate(source.getRate());
        target.setDiscountPct(source.getDiscountPct());
        target.setGstRate(source.getGstRate());
    }

    /**
     * Exact calculation from the original ERP (js/quotation-create.js):
     * grossAmt = qty * rate; discAmt = grossAmt * disc%/100; netAmt = grossAmt - discAmt;
     * cgst = sgst = netAmt * gst/2/100; lineTotal = netAmt + cgst + sgst;
     * subTotal = Σ netAmt; grandTotal = subTotal + taxTotal - discount + charges.
     */
    private void recalcTotals(Quotation quotation) {
        BigDecimal subTotal = BigDecimal.ZERO;
        BigDecimal cgstTotal = BigDecimal.ZERO;
        BigDecimal sgstTotal = BigDecimal.ZERO;
        for (QuotationItem item : quotation.getItems()) {
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
        quotation.setSubTotal(subTotal.setScale(2, RoundingMode.HALF_UP));
        quotation.setCgstTotal(cgstTotal.setScale(2, RoundingMode.HALF_UP));
        quotation.setSgstTotal(sgstTotal.setScale(2, RoundingMode.HALF_UP));
        BigDecimal taxTotal = cgstTotal.add(sgstTotal);
        quotation.setTaxTotal(taxTotal.setScale(2, RoundingMode.HALF_UP));
        BigDecimal discount = nvl(quotation.getDiscount(), BigDecimal.ZERO);
        BigDecimal charges = nvl(quotation.getCharges(), BigDecimal.ZERO)
                .add(nvl(quotation.getFreight(), BigDecimal.ZERO))
                .add(nvl(quotation.getInsurance(), BigDecimal.ZERO));
        BigDecimal grand = subTotal.add(taxTotal).subtract(discount).add(charges);
        if (grand.compareTo(BigDecimal.ZERO) < 0) {
            grand = BigDecimal.ZERO;
        }
        quotation.setGrandTotal(grand.setScale(2, RoundingMode.HALF_UP));
        if (subTotal.compareTo(BigDecimal.ZERO) > 0 && discount.compareTo(BigDecimal.ZERO) > 0) {
            quotation.setDiscountPct(discount.multiply(BigDecimal.valueOf(100))
                    .divide(subTotal, 2, RoundingMode.HALF_UP));
        } else {
            quotation.setDiscountPct(BigDecimal.ZERO);
        }
    }

    private Specification<Quotation> buildSpecification(String search, String status, String client,
                                                        String salesPerson, String dateFrom, String dateTo,
                                                        String validTill,
                                                        BigDecimal minAmount, BigDecimal maxAmount) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (search != null && !search.isBlank()) {
                String like = "%" + search.trim().toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("quotationNo")), like),
                        cb.like(cb.lower(root.get("clientName")), like),
                        cb.like(cb.lower(root.get("salesPerson")), like),
                        cb.like(cb.lower(root.get("leadNo")), like),
                        cb.like(cb.lower(cb.toString(root.get("reference"))), like),
                        cb.like(cb.lower(cb.toString(root.get("remarks"))), like)
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
            if (salesPerson != null && !salesPerson.isBlank()) {
                predicates.add(cb.equal(cb.lower(root.get("salesPerson")), salesPerson.trim().toLowerCase()));
            }
            if (dateFrom != null && !dateFrom.isBlank()) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("quotationDate"), LocalDate.parse(dateFrom).atStartOfDay()));
            }
            if (dateTo != null && !dateTo.isBlank()) {
                predicates.add(cb.lessThanOrEqualTo(root.get("quotationDate"), LocalDate.parse(dateTo).atTime(23, 59, 59)));
            }
            if (validTill != null && !validTill.isBlank()) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("validUntil"), LocalDate.parse(validTill).atStartOfDay()));
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
            case "clientName", "salesPerson", "quotationDate", "validUntil", "grandTotal", "status", "createdAt", "updatedAt" -> field;
            case "id", "quotationNo" -> "quotationNo";
            case "itemsCount" -> "id";
            default -> "createdAt";
        };
        boolean asc = parts.length > 1 && "asc".equalsIgnoreCase(parts[1]);
        return Sort.by(asc ? Sort.Direction.ASC : Sort.Direction.DESC, mapped);
    }

    private long nextSequence() {
        long count = quotationRepository.count();
        long maxSuffix = 0;
        String prefix = "Q-" + Year.now().getValue() + "-";
        for (Quotation quotation : quotationRepository.findAll()) {
            String no = quotation.getQuotationNo();
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
        return String.format("QTN-%d-%06d", Year.now().getValue(), sequence);
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

    private String buildPiNumber() {
        long maxSuffix = 0;
        String prefix = "PI-" + Year.now().getValue() + "-";
        for (ProformaInvoice doc : proformaInvoiceRepository.findAll()) {
            String no = doc.getPiNo();
            if (no != null && no.startsWith(prefix)) {
                try {
                    maxSuffix = Math.max(maxSuffix, Long.parseLong(no.substring(prefix.length())));
                } catch (NumberFormatException ignored) {
                    // skip malformed numbers
                }
            }
        }
        return String.format("PI-%d-%06d", Year.now().getValue(), Math.max(proformaInvoiceRepository.count(), maxSuffix) + 1);
    }

    private String buildInvoiceNumber() {
        long maxSuffix = 0;
        String prefix = "INV-" + Year.now().getValue() + "-";
        for (Invoice doc : invoiceRepository.findAll()) {
            String no = doc.getInvoiceNo();
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

    private String buildCnNumber() {
        long maxSuffix = 0;
        String prefix = "CN-" + Year.now().getValue() + "-";
        for (CreditNote doc : creditNoteRepository.findAll()) {
            String no = doc.getCnNo();
            if (no != null && no.startsWith(prefix)) {
                try {
                    maxSuffix = Math.max(maxSuffix, Long.parseLong(no.substring(prefix.length())));
                } catch (NumberFormatException ignored) {
                    // skip malformed numbers
                }
            }
        }
        return String.format("CN-%d-%06d", Year.now().getValue(), Math.max(creditNoteRepository.count(), maxSuffix) + 1);
    }

    private String buildPrNumber() {
        long maxSuffix = 0;
        String prefix = "PR-" + Year.now().getValue() + "-";
        for (PaymentReceipt doc : paymentReceiptRepository.findAll()) {
            String no = doc.getReceiptNo();
            if (no != null && no.startsWith(prefix)) {
                try {
                    maxSuffix = Math.max(maxSuffix, Long.parseLong(no.substring(prefix.length())));
                } catch (NumberFormatException ignored) {
                    // skip malformed numbers
                }
            }
        }
        return String.format("PR-%d-%06d", Year.now().getValue(), Math.max(paymentReceiptRepository.count(), maxSuffix) + 1);
    }

    private String buildDcNumber() {
        long maxSuffix = 0;
        String prefix = "DC-" + Year.now().getValue() + "-";
        for (DeliveryChallan doc : deliveryChallanRepository.findAll()) {
            String no = doc.getDcNo();
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
            case "negotiation" -> "negotiation";
            case "converted" -> "converted";
            case "archived" -> "archived";
            case "deleted" -> "deleted";
            case "accepted" -> "accepted";
            case "rejected" -> "rejected";
            case "expired" -> "expired";
            case "cancelled" -> "cancelled";
            case "sent" -> "sent";
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

    private void addTimeline(Quotation quotation, String type, String title, String detail) {
        SalesTimeline entry = new SalesTimeline();
        entry.setModuleType(MODULE);
        entry.setModuleId(quotation.getId());
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

    /** Adds a timeline entry for a document created by a conversion (different module). */
    private void addTargetTimeline(String module, Long id, String type, String title, String detail) {
        SalesTimeline entry = new SalesTimeline();
        entry.setModuleType(module);
        entry.setModuleId(id);
        entry.setType(type);
        entry.setTitle(title);
        entry.setDetail(detail);
        timelineRepository.save(entry);
    }

    /** Adds a history entry for a document created by a conversion (different module). */
    private void addTargetHistory(String module, Long id, String field, String newValue, String changedBy) {
        SalesHistory entry = new SalesHistory();
        entry.setModuleType(module);
        entry.setModuleId(id);
        entry.setField(field);
        entry.setOldValue(null);
        entry.setNewValue(newValue);
        entry.setChangedBy(changedBy);
        historyRepository.save(entry);
    }

    private void addHistory(Quotation quotation, String field, String oldValue, String newValue, String changedBy) {
        SalesHistory entry = new SalesHistory();
        entry.setModuleType(MODULE);
        entry.setModuleId(quotation.getId());
        entry.setField(field);
        entry.setOldValue(oldValue);
        entry.setNewValue(newValue);
        entry.setChangedBy(changedBy);
        historyRepository.save(entry);
    }
}
