package com.vishatech.erp.service;

import com.vishatech.erp.dto.DeliveryChallanItemRequest;
import com.vishatech.erp.dto.DeliveryChallanItemResponse;
import com.vishatech.erp.dto.DeliveryChallanNextNumberResponse;
import com.vishatech.erp.dto.DeliveryChallanRequest;
import com.vishatech.erp.dto.DeliveryChallanResponse;
import com.vishatech.erp.dto.SalesAttachmentResponse;
import com.vishatech.erp.dto.SalesHistoryResponse;
import com.vishatech.erp.dto.SalesTimelineResponse;
import com.vishatech.erp.entity.DeliveryChallan;
import com.vishatech.erp.entity.DeliveryChallanItem;
import com.vishatech.erp.entity.Invoice;
import com.vishatech.erp.entity.InvoiceItem;
import com.vishatech.erp.entity.SalesAttachment;
import com.vishatech.erp.entity.SalesHistory;
import com.vishatech.erp.entity.SalesTimeline;
import com.vishatech.erp.exception.BadRequestException;
import com.vishatech.erp.exception.ResourceNotFoundException;
import com.vishatech.erp.repository.DeliveryChallanRepository;
import com.vishatech.erp.repository.InvoiceRepository;
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
public class DeliveryChallanService {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final String MODULE = "delivery-challan";

    private final DeliveryChallanRepository deliveryChallanRepository;
    private final InvoiceRepository invoiceRepository;
    private final SalesTimelineRepository timelineRepository;
    private final SalesHistoryRepository historyRepository;
    private final SalesAttachmentRepository attachmentRepository;
    private final FileStorageService fileStorageService;
    private final String baseUrl;

    public DeliveryChallanService(DeliveryChallanRepository deliveryChallanRepository,
                                  InvoiceRepository invoiceRepository,
                                  SalesTimelineRepository timelineRepository,
                                  SalesHistoryRepository historyRepository,
                                  SalesAttachmentRepository attachmentRepository,
                                  FileStorageService fileStorageService,
                                  @Value("${app.base-url:http://localhost:8080}") String baseUrl) {
        this.deliveryChallanRepository = deliveryChallanRepository;
        this.invoiceRepository = invoiceRepository;
        this.timelineRepository = timelineRepository;
        this.historyRepository = historyRepository;
        this.attachmentRepository = attachmentRepository;
        this.fileStorageService = fileStorageService;
        this.baseUrl = baseUrl;
    }

    public Page<DeliveryChallanResponse> list(int page, int size, String search, String sort,
                                              String status, String client, String soRef,
                                              String dateFrom, String dateTo,
                                              BigDecimal minAmount, BigDecimal maxAmount) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(size, 1), 200);
        Pageable pageable = PageRequest.of(safePage, safeSize, buildSort(sort));
        Specification<DeliveryChallan> spec = buildSpecification(search, status, client, soRef,
                dateFrom, dateTo, minAmount, maxAmount);
        return deliveryChallanRepository.findAll(spec, pageable).map(this::toResponse);
    }

    public DeliveryChallanResponse get(Long id) {
        return toResponse(getDc(id));
    }

    public DeliveryChallanNextNumberResponse getNextNumber() {
        long next = nextSequence();
        return new DeliveryChallanNextNumberResponse(buildNo(next), next);
    }

    public Map<String, Object> stats() {
        List<String> excluded = List.of("archived", "deleted");
        Map<String, Object> stats = new LinkedHashMap<>();
        long active = 0;
        for (String status : List.of("draft", "packed", "dispatched", "in transit", "delivered", "cancelled")) {
            long count = deliveryChallanRepository.countByStatus(status);
            stats.put(status.replace(" ", ""), count);
            active += count;
        }
        stats.put("total", active);
        stats.put("active", active);
        stats.put("archived", deliveryChallanRepository.countByStatus("archived"));
        stats.put("deleted", deliveryChallanRepository.countByStatus("deleted"));
        stats.put("totalAmt", deliveryChallanRepository.sumGrandTotalExcluding(excluded));
        return stats;
    }

    public DeliveryChallanResponse create(DeliveryChallanRequest request, boolean draft) {
        DeliveryChallan dc = new DeliveryChallan();
        if (request.dcNo() != null && !request.dcNo().isBlank()) {
            if (deliveryChallanRepository.existsByDcNo(request.dcNo().trim())) {
                throw new BadRequestException("Delivery Challan number already exists: " + request.dcNo());
            }
            dc.setDcNo(request.dcNo().trim());
        } else {
            dc.setDcNo(buildNo(nextSequence()));
        }
        applyRequest(dc, request);
        if (draft) {
            dc.setStatus("draft");
        } else if (request.status() != null && !request.status().isBlank()) {
            dc.setStatus(normalizeStatus(request.status()));
        } else {
            dc.setStatus("draft");
        }
        recalcTotals(dc);
        // Persist first so the generated id is available for timeline/history rows
        // (their module_id column is NOT NULL).
        DeliveryChallan saved = deliveryChallanRepository.saveAndFlush(dc);
        addTimeline(saved, "created", "Delivery Challan created",
                "Delivery Challan '" + saved.getDcNo() + "' was created.");
        addHistory(saved, "Delivery Challan", null, saved.getDcNo(), currentUserName());
        return toResponse(saved);
    }

    public DeliveryChallanResponse update(Long id, DeliveryChallanRequest request) {
        DeliveryChallan dc = getDc(id);
        applyRequest(dc, request);
        if (request.status() != null && !request.status().isBlank()) {
            dc.setStatus(normalizeStatus(request.status()));
        }
        recalcTotals(dc);
        addTimeline(dc, "updated", "Delivery Challan updated",
                "Delivery Challan details were updated by " + currentUserName() + ".");
        return toResponse(deliveryChallanRepository.save(dc));
    }

    public DeliveryChallanResponse delete(Long id) {
        DeliveryChallan dc = getDc(id);
        dc.setStatus("deleted");
        dc.setArchivedAt(LocalDateTime.now());
        addTimeline(dc, "deleted", "Delivery Challan deleted",
                "Delivery Challan was moved to trash by " + currentUserName() + ".");
        addHistory(dc, "Status", null, "Deleted", currentUserName());
        return toResponse(deliveryChallanRepository.save(dc));
    }

    public DeliveryChallanResponse restore(Long id) {
        DeliveryChallan dc = getDc(id);
        String previous = dc.getStatus();
        String target = ("deleted".equals(previous) || "archived".equals(previous)) ? "draft" : previous;
        dc.setStatus(target);
        dc.setArchivedAt(null);
        addTimeline(dc, "restored", "Delivery Challan restored",
                "Delivery Challan was restored by " + currentUserName() + ".");
        addHistory(dc, "Status", titleCase(previous), titleCase(target), currentUserName());
        return toResponse(deliveryChallanRepository.save(dc));
    }

    public DeliveryChallanResponse archive(Long id) {
        DeliveryChallan dc = getDc(id);
        dc.setStatus("archived");
        dc.setArchivedAt(LocalDateTime.now());
        addTimeline(dc, "archived", "Delivery Challan archived",
                "Delivery Challan was archived by " + currentUserName() + ".");
        addHistory(dc, "Status", null, "Archived", currentUserName());
        return toResponse(deliveryChallanRepository.save(dc));
    }

    public DeliveryChallanResponse changeStatus(Long id, String status) {
        DeliveryChallan dc = getDc(id);
        String normalized = normalizeStatus(status);
        if ("deleted".equals(dc.getStatus())) {
            throw new BadRequestException("Cannot change status of a deleted Delivery Challan");
        }
        dc.setStatus(normalized);
        addTimeline(dc, "status", "Status changed",
                "Status changed to '" + titleCase(normalized) + "' by " + currentUserName() + ".");
        addHistory(dc, "Status", null, titleCase(normalized), currentUserName());
        return toResponse(deliveryChallanRepository.save(dc));
    }

    public DeliveryChallanResponse duplicate(Long id) {
        DeliveryChallan source = getDc(id);
        DeliveryChallan copy = new DeliveryChallan();
        copy.setDcNo(buildNo(nextSequence()));
        copy.setSoRef(source.getSoRef());
        copy.setScRef(source.getScRef());
        copy.setClientId(source.getClientId());
        copy.setClientName(source.getClientName());
        copy.setContactPerson(source.getContactPerson());
        copy.setEmail(source.getEmail());
        copy.setPhone(source.getPhone());
        copy.setBillingAddress(source.getBillingAddress());
        copy.setShippingAddress(source.getShippingAddress());
        copy.setCity(source.getCity());
        copy.setState(source.getState());
        copy.setTransportCompany(source.getTransportCompany());
        copy.setVehicleNumber(source.getVehicleNumber());
        copy.setDriverName(source.getDriverName());
        copy.setDriverPhone(source.getDriverPhone());
        copy.setLrNumber(source.getLrNumber());
        copy.setEwayBill(source.getEwayBill());
        copy.setNotes(source.getNotes());
        copy.setTerms(source.getTerms());
        copy.setDiscount(source.getDiscount());
        copy.setCharges(source.getCharges());
        copy.setDispatchDate(source.getDispatchDate());
        copy.setDeliveryDate(source.getDeliveryDate());
        copy.setStatus("draft");
        copy.setDcDate(LocalDateTime.now());
        for (DeliveryChallanItem sourceItem : source.getItems()) {
            DeliveryChallanItem item = new DeliveryChallanItem();
            copyItem(item, sourceItem);
            copy.addItem(item);
        }
        recalcTotals(copy);
        // Persist first so the generated id is available for timeline/history rows
        // (their module_id column is NOT NULL).
        DeliveryChallan saved = deliveryChallanRepository.saveAndFlush(copy);
        addTimeline(saved, "created", "Delivery Challan created",
                "Duplicated from Delivery Challan '" + source.getDcNo() + "'.");
        addHistory(saved, "Delivery Challan", null, saved.getDcNo(), currentUserName());
        return toResponse(saved);
    }

    public int bulkArchive(List<Long> ids) {
        int count = 0;
        for (Long id : ids) {
            DeliveryChallan dc = getDc(id);
            if (!"archived".equals(dc.getStatus()) && !"deleted".equals(dc.getStatus())) {
                dc.setStatus("archived");
                dc.setArchivedAt(LocalDateTime.now());
                addTimeline(dc, "archived", "Delivery Challan archived",
                        "Delivery Challan was archived by " + currentUserName() + ".");
                deliveryChallanRepository.save(dc);
                count++;
            }
        }
        return count;
    }

    public int bulkRestore(List<Long> ids) {
        int count = 0;
        for (Long id : ids) {
            DeliveryChallan dc = getDc(id);
            if ("archived".equals(dc.getStatus()) || "deleted".equals(dc.getStatus())) {
                dc.setStatus("draft");
                dc.setArchivedAt(null);
                addTimeline(dc, "restored", "Delivery Challan restored",
                        "Delivery Challan was restored by " + currentUserName() + ".");
                deliveryChallanRepository.save(dc);
                count++;
            }
        }
        return count;
    }

    public int bulkDelete(List<Long> ids) {
        List<DeliveryChallan> dcs = deliveryChallanRepository.findAllById(ids);
        deliveryChallanRepository.deleteAll(dcs);
        return dcs.size();
    }

    /** Delivery Challan → Invoice conversion (ERP: Generate Invoice). */
    public DeliveryChallanResponse convertToInvoice(Long id) {
        DeliveryChallan dc = getDc(id);
        if (dc.getConvertedToInvoice() != null && !dc.getConvertedToInvoice().isBlank()) {
            throw new BadRequestException("Delivery Challan already converted to " + dc.getConvertedToInvoice());
        }
        Invoice invoice = new Invoice();
        invoice.setInvoiceNo(buildInvoiceNumber());
        invoice.setInvoiceDate(LocalDateTime.now());
        invoice.setStatus("draft");
        invoice.setSource("dc");
        invoice.setSourceRef(dc.getDcNo());
        invoice.setClientId(dc.getClientId());
        invoice.setClientName(dc.getClientName());
        invoice.setContactPerson(dc.getContactPerson());
        invoice.setEmail(dc.getEmail());
        invoice.setPhone(dc.getPhone());
        invoice.setBillingAddress(dc.getBillingAddress());
        invoice.setShippingAddress(dc.getShippingAddress());
        invoice.setTerms(dc.getTerms());
        invoice.setNotes(dc.getNotes());
        for (DeliveryChallanItem sourceItem : dc.getItems()) {
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
        invoice.setSubTotal(dc.getSubTotal());
        invoice.setDiscount(dc.getDiscount());
        invoice.setDiscountPct(dc.getDiscountPct());
        invoice.setTaxTotal(dc.getTaxTotal());
        invoice.setCgstTotal(dc.getCgstTotal());
        invoice.setSgstTotal(dc.getSgstTotal());
        invoice.setCharges(dc.getCharges());
        invoice.setGrandTotal(dc.getGrandTotal());
        Invoice savedInvoice = invoiceRepository.save(invoice);

        addTargetTimeline("invoice", savedInvoice.getId(), "created", "Invoice created",
                "Invoice '" + savedInvoice.getInvoiceNo() + "' created from Delivery Challan '" + dc.getDcNo() + "'.");
        addTargetHistory("invoice", savedInvoice.getId(), "Invoice", savedInvoice.getInvoiceNo(), currentUserName());

        dc.setStatus("converted");
        dc.setConvertedToInvoice(invoice.getInvoiceNo());
        addTimeline(dc, "converted", "Converted to Invoice",
                "Delivery Challan converted to Invoice " + invoice.getInvoiceNo() + ".");
        addHistory(dc, "Status", null, "Converted", currentUserName());
        return toResponse(deliveryChallanRepository.save(dc));
    }

    public List<DeliveryChallanResponse> export(String search, String status, String client, String soRef,
                                                String dateFrom, String dateTo,
                                                BigDecimal minAmount, BigDecimal maxAmount) {
        Specification<DeliveryChallan> spec = buildSpecification(search, status, client, soRef,
                dateFrom, dateTo, minAmount, maxAmount);
        return deliveryChallanRepository.findAll(spec).stream().map(this::toResponse).toList();
    }

    public String buildCsv(List<DeliveryChallanResponse> dcs) {
        StringBuilder sb = new StringBuilder();
        sb.append("DC No,Date,Sales Order,Client,Status,Items,Amount,Created\n");
        for (DeliveryChallanResponse d : dcs) {
            sb.append(escapeCsv(d.dcNo())).append(',')
              .append(escapeCsv(d.date())).append(',')
              .append(escapeCsv(d.soRef())).append(',')
              .append(escapeCsv(d.clientName())).append(',')
              .append(escapeCsv(d.status())).append(',')
              .append(d.itemsCount() == null ? "" : d.itemsCount()).append(',')
              .append(d.grandTotal() == null ? "" : d.grandTotal().toPlainString()).append(',')
              .append(escapeCsv(d.createdAt())).append('\n');
        }
        return sb.toString();
    }

    public List<SalesTimelineResponse> getTimeline(Long id) {
        getDc(id);
        return timelineRepository.findByModuleTypeAndModuleIdOrderByCreatedAtAsc(MODULE, id)
                .stream().map(this::timelineResponse).toList();
    }

    public List<SalesHistoryResponse> getHistory(Long id) {
        getDc(id);
        return historyRepository.findByModuleTypeAndModuleIdOrderByCreatedAtAsc(MODULE, id)
                .stream().map(this::historyResponse).toList();
    }

    public List<SalesAttachmentResponse> getAttachments(Long id) {
        getDc(id);
        return attachmentRepository.findByModuleTypeAndModuleIdOrderByUploadedAtAsc(MODULE, id)
                .stream().map(this::attachmentResponse).toList();
    }

    public SalesAttachmentResponse addAttachment(Long id, MultipartFile file) {
        getDc(id);
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
        getDc(id);
        SalesAttachment attachment = attachmentRepository.findById(attachmentId)
                .filter(a -> MODULE.equals(a.getModuleType()) && id.equals(a.getModuleId()))
                .orElseThrow(() -> new ResourceNotFoundException("Attachment not found with id: " + attachmentId));
        attachmentRepository.delete(attachment);
    }

    private DeliveryChallanResponse toResponse(DeliveryChallan dc) {
        List<DeliveryChallanItemResponse> itemResponses = dc.getItems().stream().map(this::itemResponse).toList();
        BigDecimal totalQty = itemResponses.stream()
                .map(DeliveryChallanItemResponse::qty)
                .filter(java.util.Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return new DeliveryChallanResponse(
                dc.getId(), dc.getDcNo(), dc.getSoRef(),
                dc.getDcDate() == null ? null : dc.getDcDate().toLocalDate().toString(),
                dc.getScRef(), dc.getStatus(),
                dc.getClientId(), dc.getClientName(), dc.getContactPerson(),
                dc.getEmail(), dc.getPhone(), dc.getBillingAddress(), dc.getShippingAddress(),
                dc.getCity(), dc.getState(), dc.getTransportCompany(), dc.getVehicleNumber(),
                dc.getDriverName(), dc.getDriverPhone(), dc.getLrNumber(), dc.getEwayBill(),
                dc.getDispatchDate() == null ? null : dc.getDispatchDate().toLocalDate().toString(),
                dc.getDeliveryDate() == null ? null : dc.getDeliveryDate().toLocalDate().toString(),
                dc.getNotes(), dc.getTerms(),
                dc.getSubTotal(), dc.getDiscount(), dc.getDiscountPct(),
                dc.getCgstTotal(), dc.getSgstTotal(), dc.getTaxTotal(),
                dc.getCharges(), dc.getGrandTotal(), dc.getConvertedToInvoice(),
                itemResponses.size(), totalQty,
                dc.getDcDate() == null
                        ? (dc.getCreatedAt() == null ? null : dc.getCreatedAt().toLocalDate().toString())
                        : dc.getDcDate().toLocalDate().toString(),
                dc.getCreatedAt() == null ? null : dc.getCreatedAt().toString(),
                dc.getUpdatedAt() == null ? null : dc.getUpdatedAt().toString(),
                dc.getArchivedAt() == null ? null : dc.getArchivedAt().toString(),
                itemResponses,
                attachmentRepository.findByModuleTypeAndModuleIdOrderByUploadedAtAsc(MODULE, dc.getId())
                        .stream().map(this::attachmentResponse).toList(),
                timelineRepository.findByModuleTypeAndModuleIdOrderByCreatedAtAsc(MODULE, dc.getId())
                        .stream().map(this::timelineResponse).toList(),
                historyRepository.findByModuleTypeAndModuleIdOrderByCreatedAtAsc(MODULE, dc.getId())
                        .stream().map(this::historyResponse).toList()
        );
    }

    private DeliveryChallanItemResponse itemResponse(DeliveryChallanItem item) {
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
        return new DeliveryChallanItemResponse(item.getId(), item.getDescription(), item.getSku(), item.getHsn(),
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

    private DeliveryChallan getDc(Long id) {
        return deliveryChallanRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Delivery Challan not found with id: " + id));
    }

    private void applyRequest(DeliveryChallan dc, DeliveryChallanRequest request) {
        dc.setSoRef(request.soRef());
        dc.setDcDate(parseDate(request.dcDate()));
        dc.setScRef(request.scRef());
        dc.setClientId(request.clientId());
        dc.setClientName(request.clientName());
        dc.setContactPerson(request.contactPerson());
        dc.setEmail(request.email());
        dc.setPhone(request.phone());
        dc.setBillingAddress(request.billingAddress());
        dc.setShippingAddress(request.shippingAddress());
        dc.setCity(request.city());
        dc.setState(request.state());
        dc.setTransportCompany(request.transportCompany());
        dc.setVehicleNumber(request.vehicleNumber());
        dc.setDriverName(request.driverName());
        dc.setDriverPhone(request.driverPhone());
        dc.setLrNumber(request.lrNumber());
        dc.setEwayBill(request.ewayBill());
        dc.setDispatchDate(parseDate(request.dispatchDate()));
        dc.setDeliveryDate(parseDate(request.deliveryDate()));
        dc.setNotes(request.notes());
        dc.setTerms(request.terms());
        dc.setDiscount(request.discount() == null ? BigDecimal.ZERO : request.discount());
        dc.setCharges(request.charges() == null ? BigDecimal.ZERO : request.charges());
        dc.getItems().clear();
        if (request.items() != null) {
            for (DeliveryChallanItemRequest itemRequest : request.items()) {
                if (itemRequest == null) {
                    continue;
                }
                DeliveryChallanItem item = new DeliveryChallanItem();
                item.setDescription(itemRequest.description());
                item.setSku(itemRequest.sku());
                item.setHsn(itemRequest.hsn());
                item.setUom(itemRequest.uom());
                item.setQty(nvl(itemRequest.qty(), BigDecimal.ONE));
                item.setRate(nvl(itemRequest.rate(), BigDecimal.ZERO));
                item.setDiscountPct(nvl(itemRequest.discountPct(), BigDecimal.ZERO));
                item.setGstRate(nvl(itemRequest.gstRate(), BigDecimal.ZERO));
                dc.addItem(item);
            }
        }
    }

    private void copyItem(DeliveryChallanItem target, DeliveryChallanItem source) {
        target.setDescription(source.getDescription());
        target.setSku(source.getSku());
        target.setHsn(source.getHsn());
        target.setUom(source.getUom());
        target.setQty(source.getQty());
        target.setRate(source.getRate());
        target.setDiscountPct(source.getDiscountPct());
        target.setGstRate(source.getGstRate());
    }

    private void recalcTotals(DeliveryChallan dc) {
        BigDecimal subTotal = BigDecimal.ZERO;
        BigDecimal cgstTotal = BigDecimal.ZERO;
        BigDecimal sgstTotal = BigDecimal.ZERO;
        for (DeliveryChallanItem item : dc.getItems()) {
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
        dc.setSubTotal(subTotal.setScale(2, RoundingMode.HALF_UP));
        dc.setCgstTotal(cgstTotal.setScale(2, RoundingMode.HALF_UP));
        dc.setSgstTotal(sgstTotal.setScale(2, RoundingMode.HALF_UP));
        BigDecimal taxTotal = cgstTotal.add(sgstTotal);
        dc.setTaxTotal(taxTotal.setScale(2, RoundingMode.HALF_UP));
        BigDecimal discount = nvl(dc.getDiscount(), BigDecimal.ZERO);
        BigDecimal charges = nvl(dc.getCharges(), BigDecimal.ZERO);
        BigDecimal grand = subTotal.add(taxTotal).subtract(discount).add(charges);
        if (grand.compareTo(BigDecimal.ZERO) < 0) {
            grand = BigDecimal.ZERO;
        }
        dc.setGrandTotal(grand.setScale(2, RoundingMode.HALF_UP));
        if (subTotal.compareTo(BigDecimal.ZERO) > 0 && discount.compareTo(BigDecimal.ZERO) > 0) {
            dc.setDiscountPct(discount.multiply(BigDecimal.valueOf(100))
                    .divide(subTotal, 2, RoundingMode.HALF_UP));
        } else {
            dc.setDiscountPct(BigDecimal.ZERO);
        }
    }

    private Specification<DeliveryChallan> buildSpecification(String search, String status, String client,
                                                              String soRef, String dateFrom, String dateTo,
                                                              BigDecimal minAmount, BigDecimal maxAmount) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (search != null && !search.isBlank()) {
                String like = "%" + search.trim().toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("dcNo")), like),
                        cb.like(cb.lower(root.get("clientName")), like),
                        cb.like(cb.lower(root.get("soRef")), like),
                        cb.like(cb.lower(root.get("scRef")), like),
                        cb.like(cb.lower(cb.toString(root.get("transportCompany"))), like),
                        cb.like(cb.lower(cb.toString(root.get("vehicleNumber"))), like)
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
            if (soRef != null && !soRef.isBlank()) {
                predicates.add(cb.equal(cb.lower(root.get("soRef")), soRef.trim().toLowerCase()));
            }
            if (dateFrom != null && !dateFrom.isBlank()) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("dcDate"), LocalDate.parse(dateFrom).atStartOfDay()));
            }
            if (dateTo != null && !dateTo.isBlank()) {
                predicates.add(cb.lessThanOrEqualTo(root.get("dcDate"), LocalDate.parse(dateTo).atTime(23, 59, 59)));
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
            case "clientName", "soRef", "dcDate", "dispatchDate", "deliveryDate", "grandTotal", "status", "createdAt",
                 "updatedAt", "dcNo" -> "dcNo".equals(field) ? "dcNo" : field;
            case "id" -> "dcNo";
            default -> "createdAt";
        };
        boolean asc = parts.length > 1 && "asc".equalsIgnoreCase(parts[1]);
        return Sort.by(asc ? Sort.Direction.ASC : Sort.Direction.DESC, mapped);
    }

    private long nextSequence() {
        long count = deliveryChallanRepository.count();
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
        return Math.max(count, maxSuffix) + 1;
    }

    private String buildNo(long sequence) {
        return String.format("DC-%d-%06d", Year.now().getValue(), sequence);
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
            case "packed" -> "packed";
            case "dispatched" -> "dispatched";
            case "in_transit", "in transit" -> "in transit";
            case "delivered" -> "delivered";
            case "accepted" -> "accepted";
            case "converted" -> "converted";
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

    private void addTimeline(DeliveryChallan dc, String type, String title, String detail) {
        SalesTimeline entry = new SalesTimeline();
        entry.setModuleType(MODULE);
        entry.setModuleId(dc.getId());
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

    private void addHistory(DeliveryChallan dc, String field, String oldValue, String newValue, String changedBy) {
        SalesHistory entry = new SalesHistory();
        entry.setModuleType(MODULE);
        entry.setModuleId(dc.getId());
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
