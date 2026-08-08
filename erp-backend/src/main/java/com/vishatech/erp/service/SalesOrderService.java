package com.vishatech.erp.service;

import com.vishatech.erp.dto.SalesAttachmentResponse;
import com.vishatech.erp.dto.SalesHistoryResponse;
import com.vishatech.erp.dto.SalesOrderItemRequest;
import com.vishatech.erp.dto.SalesOrderItemResponse;
import com.vishatech.erp.dto.SalesOrderNextNumberResponse;
import com.vishatech.erp.dto.SalesOrderRequest;
import com.vishatech.erp.dto.SalesOrderResponse;
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
import com.vishatech.erp.repository.SalesAttachmentRepository;
import com.vishatech.erp.repository.SalesHistoryRepository;
import com.vishatech.erp.repository.SalesOrderRepository;
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
public class SalesOrderService {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final String MODULE = "sales-order";

    private final SalesOrderRepository salesOrderRepository;
    private final SalesTimelineRepository timelineRepository;
    private final SalesHistoryRepository historyRepository;
    private final SalesAttachmentRepository attachmentRepository;
    private final DeliveryChallanRepository deliveryChallanRepository;
    private final InvoiceRepository invoiceRepository;
    private final ProformaInvoiceRepository proformaInvoiceRepository;
    private final FileStorageService fileStorageService;
    private final String baseUrl;

    public SalesOrderService(SalesOrderRepository salesOrderRepository,
                             SalesTimelineRepository timelineRepository,
                             SalesHistoryRepository historyRepository,
                             SalesAttachmentRepository attachmentRepository,
                             DeliveryChallanRepository deliveryChallanRepository,
                             InvoiceRepository invoiceRepository,
                             ProformaInvoiceRepository proformaInvoiceRepository,
                             FileStorageService fileStorageService,
                             @Value("${app.base-url:http://localhost:8080}") String baseUrl) {
        this.salesOrderRepository = salesOrderRepository;
        this.timelineRepository = timelineRepository;
        this.historyRepository = historyRepository;
        this.attachmentRepository = attachmentRepository;
        this.deliveryChallanRepository = deliveryChallanRepository;
        this.invoiceRepository = invoiceRepository;
        this.proformaInvoiceRepository = proformaInvoiceRepository;
        this.fileStorageService = fileStorageService;
        this.baseUrl = baseUrl;
    }

    // ============================== Read ==============================

    public Page<SalesOrderResponse> list(int page, int size, String search, String sort,
                                         String status, String client, String salesExecutive,
                                         String dateFrom, String dateTo,
                                         BigDecimal minAmount, BigDecimal maxAmount) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(size, 1), 200);
        Pageable pageable = PageRequest.of(safePage, safeSize, buildSort(sort));
        Specification<SalesOrder> spec = buildSpecification(search, status, client, salesExecutive,
                dateFrom, dateTo, minAmount, maxAmount);
        return salesOrderRepository.findAll(spec, pageable).map(this::toResponse);
    }

    public SalesOrderResponse get(Long id) {
        return toResponse(getSalesOrder(id));
    }

    public SalesOrderNextNumberResponse getNextNumber() {
        long next = nextSequence();
        return new SalesOrderNextNumberResponse(buildNo(next), next);
    }

    public Map<String, Object> stats() {
        List<String> excluded = List.of("archived", "deleted");
        Map<String, Object> stats = new LinkedHashMap<>();
        long active = 0;
        for (String status : List.of("draft", "pending review", "approved", "in progress", "completed", "cancelled")) {
            long count = salesOrderRepository.countByStatus(status);
            stats.put(status.replace(" ", ""), count);
            active += count;
        }
        stats.put("total", active);
        stats.put("active", active);
        stats.put("archived", salesOrderRepository.countByStatus("archived"));
        stats.put("deleted", salesOrderRepository.countByStatus("deleted"));
        stats.put("totalAmt", salesOrderRepository.sumGrandTotalExcluding(excluded));
        return stats;
    }

    // ============================== Write ==============================

    public SalesOrderResponse create(SalesOrderRequest request, boolean draft) {
        SalesOrder salesOrder = new SalesOrder();
        if (request.soNo() != null && !request.soNo().isBlank()) {
            if (salesOrderRepository.existsBySoNo(request.soNo().trim())) {
                throw new BadRequestException("Sales Order number already exists: " + request.soNo());
            }
            salesOrder.setSoNo(request.soNo().trim());
        } else {
            salesOrder.setSoNo(buildNo(nextSequence()));
        }
        applyRequest(salesOrder, request);
        if (draft) {
            salesOrder.setStatus("draft");
        } else if (request.status() != null && !request.status().isBlank()) {
            salesOrder.setStatus(normalizeStatus(request.status()));
        } else {
            salesOrder.setStatus("draft");
        }
        recalcTotals(salesOrder);
        SalesOrder saved = salesOrderRepository.save(salesOrder);
        addTimeline(saved, "created", "Sales Order created",
                "Sales Order '" + saved.getSoNo() + "' was created.");
        addHistory(saved, "Sales Order", null, saved.getSoNo(), currentUserName());
        return toResponse(saved);
    }

    public SalesOrderResponse update(Long id, SalesOrderRequest request) {
        SalesOrder salesOrder = getSalesOrder(id);
        applyRequest(salesOrder, request);
        if (request.status() != null && !request.status().isBlank()) {
            salesOrder.setStatus(normalizeStatus(request.status()));
        }
        recalcTotals(salesOrder);
        addTimeline(salesOrder, "updated", "Sales Order updated",
                "Sales Order details were updated by " + currentUserName() + ".");
        return toResponse(salesOrderRepository.save(salesOrder));
    }

    public SalesOrderResponse delete(Long id) {
        SalesOrder salesOrder = getSalesOrder(id);
        salesOrder.setStatus("deleted");
        salesOrder.setArchivedAt(LocalDateTime.now());
        addTimeline(salesOrder, "deleted", "Sales Order deleted",
                "Sales Order was moved to trash by " + currentUserName() + ".");
        addHistory(salesOrder, "Status", null, "Deleted", currentUserName());
        return toResponse(salesOrderRepository.save(salesOrder));
    }

    public SalesOrderResponse restore(Long id) {
        SalesOrder salesOrder = getSalesOrder(id);
        String previous = salesOrder.getStatus();
        String target = ("deleted".equals(previous) || "archived".equals(previous)) ? "draft" : previous;
        salesOrder.setStatus(target);
        salesOrder.setArchivedAt(null);
        addTimeline(salesOrder, "restored", "Sales Order restored",
                "Sales Order was restored by " + currentUserName() + ".");
        addHistory(salesOrder, "Status", titleCase(previous), titleCase(target), currentUserName());
        return toResponse(salesOrderRepository.save(salesOrder));
    }

    public SalesOrderResponse archive(Long id) {
        SalesOrder salesOrder = getSalesOrder(id);
        salesOrder.setStatus("archived");
        salesOrder.setArchivedAt(LocalDateTime.now());
        addTimeline(salesOrder, "archived", "Sales Order archived",
                "Sales Order was archived by " + currentUserName() + ".");
        addHistory(salesOrder, "Status", null, "Archived", currentUserName());
        return toResponse(salesOrderRepository.save(salesOrder));
    }

    public SalesOrderResponse changeStatus(Long id, String status) {
        SalesOrder salesOrder = getSalesOrder(id);
        String normalized = normalizeStatus(status);
        if ("deleted".equals(salesOrder.getStatus())) {
            throw new BadRequestException("Cannot change status of a deleted Sales Order");
        }
        salesOrder.setStatus(normalized);
        addTimeline(salesOrder, "status", "Status changed",
                "Status changed to '" + titleCase(normalized) + "' by " + currentUserName() + ".");
        addHistory(salesOrder, "Status", null, titleCase(normalized), currentUserName());
        return toResponse(salesOrderRepository.save(salesOrder));
    }

    public SalesOrderResponse approve(Long id) {
        SalesOrder salesOrder = getSalesOrder(id);
        if ("deleted".equals(salesOrder.getStatus())) {
            throw new BadRequestException("Cannot approve a deleted Sales Order");
        }
        salesOrder.setStatus("approved");
        addTimeline(salesOrder, "approved", "Sales Order approved",
                "Sales Order approved by " + currentUserName() + ".");
        addHistory(salesOrder, "Status", null, "Approved", currentUserName());
        return toResponse(salesOrderRepository.save(salesOrder));
    }

    public SalesOrderResponse cancel(Long id) {
        SalesOrder salesOrder = getSalesOrder(id);
        if ("deleted".equals(salesOrder.getStatus())) {
            throw new BadRequestException("Cannot cancel a deleted Sales Order");
        }
        salesOrder.setStatus("cancelled");
        addTimeline(salesOrder, "cancelled", "Sales Order cancelled",
                "Sales Order cancelled by " + currentUserName() + ".");
        addHistory(salesOrder, "Status", null, "Cancelled", currentUserName());
        return toResponse(salesOrderRepository.save(salesOrder));
    }

    public SalesOrderResponse duplicate(Long id) {
        SalesOrder source = getSalesOrder(id);
        SalesOrder copy = new SalesOrder();
        copy.setSoNo(buildNo(nextSequence()));
        copy.setCustomerPo(source.getCustomerPo());
        copy.setLeadNo(source.getLeadNo());
        copy.setScRef(source.getScRef());
        copy.setQtnRef(source.getQtnRef());
        copy.setCurrency(source.getCurrency());
        copy.setPriority(source.getPriority());
        copy.setClientId(source.getClientId());
        copy.setClientName(source.getClientName());
        copy.setContactPerson(source.getContactPerson());
        copy.setEmail(source.getEmail());
        copy.setPhone(source.getPhone());
        copy.setCity(source.getCity());
        copy.setState(source.getState());
        copy.setBillingAddress(source.getBillingAddress());
        copy.setShippingAddress(source.getShippingAddress());
        copy.setGstin(source.getGstin());
        copy.setPan(source.getPan());
        copy.setPaymentTerms(source.getPaymentTerms());
        copy.setSalesExecutive(source.getSalesExecutive());
        copy.setDeliveryTerms(source.getDeliveryTerms());
        copy.setTerms(source.getTerms());
        copy.setRemarks(source.getRemarks());
        copy.setDiscount(source.getDiscount());
        copy.setCharges(source.getCharges());
        copy.setStatus("draft");
        copy.setOrderDate(LocalDateTime.now());
        for (SalesOrderItem sourceItem : source.getItems()) {
            SalesOrderItem item = new SalesOrderItem();
            copyItem(item, sourceItem);
            copy.addItem(item);
        }
        recalcTotals(copy);
        SalesOrder saved = salesOrderRepository.save(copy);
        addTimeline(saved, "created", "Sales Order created",
                "Duplicated from Sales Order '" + source.getSoNo() + "'.");
        addHistory(saved, "Sales Order", null, saved.getSoNo(), currentUserName());
        return toResponse(saved);
    }

    public int bulkArchive(List<Long> ids) {
        int count = 0;
        for (Long id : ids) {
            SalesOrder salesOrder = getSalesOrder(id);
            if (!"archived".equals(salesOrder.getStatus()) && !"deleted".equals(salesOrder.getStatus())) {
                salesOrder.setStatus("archived");
                salesOrder.setArchivedAt(LocalDateTime.now());
                addTimeline(salesOrder, "archived", "Sales Order archived",
                        "Sales Order was archived by " + currentUserName() + ".");
                salesOrderRepository.save(salesOrder);
                count++;
            }
        }
        return count;
    }

    public int bulkRestore(List<Long> ids) {
        int count = 0;
        for (Long id : ids) {
            SalesOrder salesOrder = getSalesOrder(id);
            if ("archived".equals(salesOrder.getStatus()) || "deleted".equals(salesOrder.getStatus())) {
                salesOrder.setStatus("draft");
                salesOrder.setArchivedAt(null);
                addTimeline(salesOrder, "restored", "Sales Order restored",
                        "Sales Order was restored by " + currentUserName() + ".");
                salesOrderRepository.save(salesOrder);
                count++;
            }
        }
        return count;
    }

    public int bulkDelete(List<Long> ids) {
        List<SalesOrder> salesOrders = salesOrderRepository.findAllById(ids);
        salesOrderRepository.deleteAll(salesOrders);
        return salesOrders.size();
    }

    // ============================== Conversions ==============================

    public SalesOrderResponse generateDeliveryChallan(Long id) {
        SalesOrder salesOrder = getSalesOrder(id);
        if ("deleted".equals(salesOrder.getStatus())) {
            throw new BadRequestException("Cannot generate a Delivery Challan from a deleted Sales Order");
        }
        DeliveryChallan dc = new DeliveryChallan();
        dc.setDcNo(buildModuleNumber("DC-", deliveryChallanRepository.count()));
        dc.setSoRef(salesOrder.getSoNo());
        dc.setScRef(salesOrder.getScRef());
        dc.setDcDate(LocalDateTime.now());
        dc.setStatus("draft");
        dc.setClientId(salesOrder.getClientId());
        dc.setClientName(salesOrder.getClientName());
        dc.setContactPerson(salesOrder.getContactPerson());
        dc.setEmail(salesOrder.getEmail());
        dc.setPhone(salesOrder.getPhone());
        dc.setBillingAddress(salesOrder.getBillingAddress());
        dc.setShippingAddress(salesOrder.getShippingAddress());
        dc.setCity(salesOrder.getCity());
        dc.setState(salesOrder.getState());
        for (SalesOrderItem sourceItem : salesOrder.getItems()) {
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
        dc.setSubTotal(salesOrder.getSubTotal());
        dc.setDiscount(salesOrder.getDiscount());
        dc.setTaxTotal(salesOrder.getTaxTotal());
        dc.setCgstTotal(salesOrder.getCgstTotal());
        dc.setSgstTotal(salesOrder.getSgstTotal());
        dc.setCharges(salesOrder.getCharges());
        dc.setGrandTotal(salesOrder.getGrandTotal());
        DeliveryChallan savedDc = deliveryChallanRepository.save(dc);

        addTargetTimeline("delivery-challan", savedDc.getId(), "created", "Delivery Challan created",
                "Delivery Challan '" + savedDc.getDcNo() + "' created from Sales Order '" + salesOrder.getSoNo() + "'.");
        addTargetHistory("delivery-challan", savedDc.getId(), "Delivery Challan", savedDc.getDcNo(), currentUserName());

        salesOrder.setConvertedToDc(dc.getDcNo());
        addTimeline(salesOrder, "converted", "Delivery Challan generated",
                "Delivery Challan " + dc.getDcNo() + " was generated from this Sales Order.");
        return toResponse(salesOrderRepository.save(salesOrder));
    }

    public SalesOrderResponse convertToProforma(Long id) {
        SalesOrder salesOrder = getSalesOrder(id);
        ProformaInvoice pi = new ProformaInvoice();
        pi.setPiNo(buildModuleNumber("PI-", proformaInvoiceRepository.count()));
        pi.setPiDate(LocalDateTime.now());
        pi.setStatus("draft");
        pi.setSource("so");
        pi.setSourceRef(salesOrder.getSoNo());
        pi.setClientId(salesOrder.getClientId());
        pi.setClientName(salesOrder.getClientName());
        pi.setContactPerson(salesOrder.getContactPerson());
        pi.setEmail(salesOrder.getEmail());
        pi.setPhone(salesOrder.getPhone());
        pi.setGstin(salesOrder.getGstin());
        pi.setPan(salesOrder.getPan());
        pi.setBillingAddress(salesOrder.getBillingAddress());
        pi.setShippingAddress(salesOrder.getShippingAddress());
        for (SalesOrderItem sourceItem : salesOrder.getItems()) {
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
        pi.setSubTotal(salesOrder.getSubTotal());
        pi.setDiscount(salesOrder.getDiscount());
        BigDecimal soSubTotal = nvl(salesOrder.getSubTotal(), BigDecimal.ZERO);
        if (soSubTotal.compareTo(BigDecimal.ZERO) > 0) {
            // Sales Order stores a flat discount; Proforma Invoice is percentage-based.
            pi.setDiscountPct(nvl(salesOrder.getDiscount(), BigDecimal.ZERO)
                    .multiply(BigDecimal.valueOf(100))
                    .divide(soSubTotal, 2, RoundingMode.HALF_UP));
        } else {
            pi.setDiscountPct(BigDecimal.ZERO);
        }
        pi.setTaxTotal(salesOrder.getTaxTotal());
        pi.setCgstTotal(salesOrder.getCgstTotal());
        pi.setSgstTotal(salesOrder.getSgstTotal());
        pi.setCharges(salesOrder.getCharges());
        pi.setGrandTotal(salesOrder.getGrandTotal());
        ProformaInvoice savedPi = proformaInvoiceRepository.save(pi);

        addTargetTimeline("proforma-invoice", savedPi.getId(), "created", "Proforma Invoice created",
                "Proforma Invoice '" + savedPi.getPiNo() + "' created from Sales Order '" + salesOrder.getSoNo() + "'.");
        addTargetHistory("proforma-invoice", savedPi.getId(), "Proforma Invoice", savedPi.getPiNo(), currentUserName());

        salesOrder.setConvertedToProforma(pi.getPiNo());
        addTimeline(salesOrder, "converted", "Proforma Invoice created",
                "Proforma Invoice " + pi.getPiNo() + " was created from this Sales Order.");
        return toResponse(salesOrderRepository.save(salesOrder));
    }

    public SalesOrderResponse convertToInvoice(Long id) {
        SalesOrder salesOrder = getSalesOrder(id);
        Invoice invoice = new Invoice();
        invoice.setInvoiceNo(buildModuleNumber("INV-", invoiceRepository.count()));
        invoice.setInvoiceDate(LocalDateTime.now());
        invoice.setStatus("draft");
        invoice.setSource("so");
        invoice.setSourceRef(salesOrder.getSoNo());
        invoice.setClientId(salesOrder.getClientId());
        invoice.setClientName(salesOrder.getClientName());
        invoice.setContactPerson(salesOrder.getContactPerson());
        invoice.setEmail(salesOrder.getEmail());
        invoice.setPhone(salesOrder.getPhone());
        invoice.setGstin(salesOrder.getGstin());
        invoice.setPan(salesOrder.getPan());
        invoice.setBillingAddress(salesOrder.getBillingAddress());
        invoice.setShippingAddress(salesOrder.getShippingAddress());
        for (SalesOrderItem sourceItem : salesOrder.getItems()) {
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
        invoice.setSubTotal(salesOrder.getSubTotal());
        invoice.setDiscount(salesOrder.getDiscount());
        invoice.setTaxTotal(salesOrder.getTaxTotal());
        invoice.setCgstTotal(salesOrder.getCgstTotal());
        invoice.setSgstTotal(salesOrder.getSgstTotal());
        invoice.setCharges(salesOrder.getCharges());
        invoice.setGrandTotal(salesOrder.getGrandTotal());
        Invoice savedInvoice = invoiceRepository.save(invoice);

        addTargetTimeline("invoice", savedInvoice.getId(), "created", "Invoice created",
                "Invoice '" + savedInvoice.getInvoiceNo() + "' created from Sales Order '" + salesOrder.getSoNo() + "'.");
        addTargetHistory("invoice", savedInvoice.getId(), "Invoice", savedInvoice.getInvoiceNo(), currentUserName());

        salesOrder.setConvertedToInv(invoice.getInvoiceNo());
        addTimeline(salesOrder, "converted", "Invoice created",
                "Invoice " + invoice.getInvoiceNo() + " was created from this Sales Order.");
        return toResponse(salesOrderRepository.save(salesOrder));
    }

    // ============================== Export ==============================

    public List<SalesOrderResponse> export(String search, String status, String client, String salesExecutive,
                                           String dateFrom, String dateTo, BigDecimal minAmount, BigDecimal maxAmount) {
        Specification<SalesOrder> spec = buildSpecification(search, status, client, salesExecutive,
                dateFrom, dateTo, minAmount, maxAmount);
        return salesOrderRepository.findAll(spec).stream().map(this::toResponse).toList();
    }

    public String buildCsv(List<SalesOrderResponse> salesOrders) {
        StringBuilder sb = new StringBuilder();
        sb.append("Sales Order No,Date,Client,Status,Priority,Items,Amount,Created\n");
        for (SalesOrderResponse o : salesOrders) {
            sb.append(escapeCsv(o.soNo())).append(',')
              .append(escapeCsv(o.date())).append(',')
              .append(escapeCsv(o.clientName())).append(',')
              .append(escapeCsv(o.status())).append(',')
              .append(escapeCsv(o.priority())).append(',')
              .append(o.itemsCount() == null ? "" : o.itemsCount()).append(',')
              .append(o.grandTotal() == null ? "" : o.grandTotal().toPlainString()).append(',')
              .append(escapeCsv(o.createdAt())).append('\n');
        }
        return sb.toString();
    }

    // ============================== Sub-resources ==============================

    public List<SalesTimelineResponse> getTimeline(Long id) {
        getSalesOrder(id);
        return timelineRepository.findByModuleTypeAndModuleIdOrderByCreatedAtAsc(MODULE, id)
                .stream().map(this::timelineResponse).toList();
    }

    public List<SalesHistoryResponse> getHistory(Long id) {
        getSalesOrder(id);
        return historyRepository.findByModuleTypeAndModuleIdOrderByCreatedAtAsc(MODULE, id)
                .stream().map(this::historyResponse).toList();
    }

    public List<SalesAttachmentResponse> getAttachments(Long id) {
        getSalesOrder(id);
        return attachmentRepository.findByModuleTypeAndModuleIdOrderByUploadedAtAsc(MODULE, id)
                .stream().map(this::attachmentResponse).toList();
    }

    public SalesAttachmentResponse addAttachment(Long id, MultipartFile file) {
        getSalesOrder(id);
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
        getSalesOrder(id);
        SalesAttachment attachment = attachmentRepository.findById(attachmentId)
                .filter(a -> MODULE.equals(a.getModuleType()) && id.equals(a.getModuleId()))
                .orElseThrow(() -> new ResourceNotFoundException("Attachment not found with id: " + attachmentId));
        attachmentRepository.delete(attachment);
    }

    // ============================== Mapping ==============================

    private SalesOrderResponse toResponse(SalesOrder salesOrder) {
        List<SalesOrderItemResponse> itemResponses = salesOrder.getItems().stream().map(this::itemResponse).toList();
        BigDecimal totalQty = itemResponses.stream()
                .map(SalesOrderItemResponse::qty)
                .filter(java.util.Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return new SalesOrderResponse(
                salesOrder.getId(), salesOrder.getSoNo(), salesOrder.getCustomerPo(),
                salesOrder.getOrderDate() == null ? null : salesOrder.getOrderDate().toLocalDate().toString(),
                salesOrder.getLeadNo(), salesOrder.getScRef(), salesOrder.getQtnRef(),
                salesOrder.getStatus(), salesOrder.getCurrency(), salesOrder.getPriority(),
                salesOrder.getClientId(), salesOrder.getClientName(), salesOrder.getContactPerson(),
                salesOrder.getEmail(), salesOrder.getPhone(), salesOrder.getCity(), salesOrder.getState(),
                salesOrder.getBillingAddress(), salesOrder.getShippingAddress(), salesOrder.getGstin(),
                salesOrder.getPan(), salesOrder.getPaymentTerms(), salesOrder.getSalesExecutive(),
                salesOrder.getDeliveryDate() == null ? null : salesOrder.getDeliveryDate().toLocalDate().toString(),
                salesOrder.getDeliveryTerms(), salesOrder.getTerms(), salesOrder.getRemarks(),
                salesOrder.getSubTotal(), salesOrder.getDiscount(), salesOrder.getDiscountPct(),
                salesOrder.getCgstTotal(), salesOrder.getSgstTotal(), salesOrder.getTaxTotal(),
                salesOrder.getCharges(), salesOrder.getGrandTotal(),
                itemResponses.size(), totalQty,
                salesOrder.getConvertedToInv(), salesOrder.getConvertedToDc(), salesOrder.getConvertedToProforma(),
                salesOrder.getOrderDate() == null
                        ? (salesOrder.getCreatedAt() == null ? null : salesOrder.getCreatedAt().toLocalDate().toString())
                        : salesOrder.getOrderDate().toLocalDate().toString(),
                salesOrder.getCreatedAt() == null ? null : salesOrder.getCreatedAt().toString(),
                salesOrder.getUpdatedAt() == null ? null : salesOrder.getUpdatedAt().toString(),
                salesOrder.getArchivedAt() == null ? null : salesOrder.getArchivedAt().toString(),
                itemResponses,
                attachmentRepository.findByModuleTypeAndModuleIdOrderByUploadedAtAsc(MODULE, salesOrder.getId())
                        .stream().map(this::attachmentResponse).toList(),
                timelineRepository.findByModuleTypeAndModuleIdOrderByCreatedAtAsc(MODULE, salesOrder.getId())
                        .stream().map(this::timelineResponse).toList(),
                historyRepository.findByModuleTypeAndModuleIdOrderByCreatedAtAsc(MODULE, salesOrder.getId())
                        .stream().map(this::historyResponse).toList()
        );
    }

    private SalesOrderItemResponse itemResponse(SalesOrderItem item) {
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
        return new SalesOrderItemResponse(item.getId(), item.getDescription(), item.getSku(), item.getHsn(),
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

    // ============================== Helpers ==============================

    private SalesOrder getSalesOrder(Long id) {
        return salesOrderRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Sales Order not found with id: " + id));
    }

    private void applyRequest(SalesOrder salesOrder, SalesOrderRequest request) {
        salesOrder.setCustomerPo(request.customerPo());
        salesOrder.setOrderDate(parseDate(request.orderDate()));
        salesOrder.setLeadNo(request.leadNo());
        salesOrder.setScRef(request.scRef());
        salesOrder.setQtnRef(request.qtnRef());
        salesOrder.setCurrency(request.currency());
        salesOrder.setPriority(request.priority());
        salesOrder.setClientId(request.clientId());
        salesOrder.setClientName(request.clientName());
        salesOrder.setContactPerson(request.contactPerson());
        salesOrder.setEmail(request.email());
        salesOrder.setPhone(request.phone());
        salesOrder.setCity(request.city());
        salesOrder.setState(request.state());
        salesOrder.setBillingAddress(request.billingAddress());
        salesOrder.setShippingAddress(request.shippingAddress());
        salesOrder.setGstin(request.gstin());
        salesOrder.setPan(request.pan());
        salesOrder.setPaymentTerms(request.paymentTerms());
        salesOrder.setSalesExecutive(request.salesExecutive());
        salesOrder.setDeliveryDate(parseDate(request.deliveryDate()));
        salesOrder.setDeliveryTerms(request.deliveryTerms());
        salesOrder.setTerms(request.terms());
        salesOrder.setRemarks(request.remarks());
        salesOrder.setDiscount(request.discount() == null ? BigDecimal.ZERO : request.discount());
        salesOrder.setCharges(request.charges() == null ? BigDecimal.ZERO : request.charges());
        salesOrder.getItems().clear();
        if (request.items() != null) {
            for (SalesOrderItemRequest itemRequest : request.items()) {
                if (itemRequest == null) {
                    continue;
                }
                SalesOrderItem item = new SalesOrderItem();
                item.setDescription(itemRequest.description());
                item.setSku(itemRequest.sku());
                item.setHsn(itemRequest.hsn());
                item.setUom(itemRequest.uom());
                item.setQty(nvl(itemRequest.qty(), BigDecimal.ONE));
                item.setRate(nvl(itemRequest.rate(), BigDecimal.ZERO));
                item.setDiscountPct(nvl(itemRequest.discountPct(), BigDecimal.ZERO));
                item.setGstRate(nvl(itemRequest.gstRate(), BigDecimal.ZERO));
                salesOrder.addItem(item);
            }
        }
    }

    private void copyItem(SalesOrderItem target, SalesOrderItem source) {
        target.setDescription(source.getDescription());
        target.setSku(source.getSku());
        target.setHsn(source.getHsn());
        target.setUom(source.getUom());
        target.setQty(source.getQty());
        target.setRate(source.getRate());
        target.setDiscountPct(source.getDiscountPct());
        target.setGstRate(source.getGstRate());
    }

    private void recalcTotals(SalesOrder salesOrder) {
        BigDecimal subTotal = BigDecimal.ZERO;
        BigDecimal cgstTotal = BigDecimal.ZERO;
        BigDecimal sgstTotal = BigDecimal.ZERO;
        for (SalesOrderItem item : salesOrder.getItems()) {
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
        salesOrder.setSubTotal(subTotal.setScale(2, RoundingMode.HALF_UP));
        salesOrder.setCgstTotal(cgstTotal.setScale(2, RoundingMode.HALF_UP));
        salesOrder.setSgstTotal(sgstTotal.setScale(2, RoundingMode.HALF_UP));
        BigDecimal taxTotal = cgstTotal.add(sgstTotal);
        salesOrder.setTaxTotal(taxTotal.setScale(2, RoundingMode.HALF_UP));
        BigDecimal discount = nvl(salesOrder.getDiscount(), BigDecimal.ZERO);
        BigDecimal charges = nvl(salesOrder.getCharges(), BigDecimal.ZERO);
        BigDecimal grand = subTotal.add(taxTotal).subtract(discount).add(charges);
        if (grand.compareTo(BigDecimal.ZERO) < 0) {
            grand = BigDecimal.ZERO;
        }
        salesOrder.setGrandTotal(grand.setScale(2, RoundingMode.HALF_UP));
        if (subTotal.compareTo(BigDecimal.ZERO) > 0 && discount.compareTo(BigDecimal.ZERO) > 0) {
            salesOrder.setDiscountPct(discount.multiply(BigDecimal.valueOf(100))
                    .divide(subTotal, 2, RoundingMode.HALF_UP));
        } else {
            salesOrder.setDiscountPct(BigDecimal.ZERO);
        }
    }

    private Specification<SalesOrder> buildSpecification(String search, String status, String client,
                                                         String salesExecutive, String dateFrom, String dateTo,
                                                         BigDecimal minAmount, BigDecimal maxAmount) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (search != null && !search.isBlank()) {
                String like = "%" + search.trim().toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("soNo")), like),
                        cb.like(cb.lower(root.get("clientName")), like),
                        cb.like(cb.lower(root.get("leadNo")), like),
                        cb.like(cb.lower(root.get("salesExecutive")), like),
                        cb.like(cb.lower(root.get("scRef")), like),
                        cb.like(cb.lower(root.get("qtnRef")), like),
                        cb.like(cb.lower(cb.toString(root.get("customerPo"))), like)
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
            if (salesExecutive != null && !salesExecutive.isBlank()) {
                predicates.add(cb.equal(cb.lower(root.get("salesExecutive")), salesExecutive.trim().toLowerCase()));
            }
            if (dateFrom != null && !dateFrom.isBlank()) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("orderDate"), LocalDate.parse(dateFrom).atStartOfDay()));
            }
            if (dateTo != null && !dateTo.isBlank()) {
                predicates.add(cb.lessThanOrEqualTo(root.get("orderDate"), LocalDate.parse(dateTo).atTime(23, 59, 59)));
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
            case "clientName", "salesExecutive", "orderDate", "deliveryDate", "grandTotal", "status", "priority",
                 "createdAt", "updatedAt", "soNo" -> "soNo".equals(field) ? "soNo" : field;
            case "id" -> "soNo";
            default -> "createdAt";
        };
        boolean asc = parts.length > 1 && "asc".equalsIgnoreCase(parts[1]);
        return Sort.by(asc ? Sort.Direction.ASC : Sort.Direction.DESC, mapped);
    }

    private long nextSequence() {
        long count = salesOrderRepository.count();
        long maxSuffix = 0;
        String prefix = "SO-" + Year.now().getValue() + "-";
        for (SalesOrder salesOrder : salesOrderRepository.findAll()) {
            String no = salesOrder.getSoNo();
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
        return String.format("SO-%d-%06d", Year.now().getValue(), sequence);
    }

    private String buildModuleNumber(String prefix, long baseCount) {
        long maxSuffix = 0;
        String p = prefix + Year.now().getValue() + "-";
        // The caller passes a repo count; use a conservative base of count+1
        long sequence = Math.max(baseCount, 1) + 1;
        return String.format("%s%d-%06d", prefix, Year.now().getValue(), sequence);
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
            case "pending_review", "pending review" -> "pending review";
            case "in_progress", "in progress" -> "in progress";
            case "approved" -> "approved";
            case "completed" -> "completed";
            case "cancelled" -> "cancelled";
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

    private void addTimeline(SalesOrder salesOrder, String type, String title, String detail) {
        SalesTimeline entry = new SalesTimeline();
        entry.setModuleType(MODULE);
        entry.setModuleId(salesOrder.getId());
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

    private void addHistory(SalesOrder salesOrder, String field, String oldValue, String newValue, String changedBy) {
        SalesHistory entry = new SalesHistory();
        entry.setModuleType(MODULE);
        entry.setModuleId(salesOrder.getId());
        entry.setField(field);
        entry.setOldValue(oldValue);
        entry.setNewValue(newValue);
        entry.setChangedBy(changedBy);
        historyRepository.save(entry);
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
}
